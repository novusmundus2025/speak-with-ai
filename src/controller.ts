import {
  AudioInputSource,
  CreateStartUpPageContainer,
  OsEventTypeList,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { hudText } from './hud';
import { analyzeConversation } from './mundusx';
import { GermanTranscriber } from './transcription';
import type { AppState } from './types';

const HUD_CONTAINER_ID = 1;
const HUD_CONTAINER_NAME = 'conversation-hud';

export type StateListener = (state: AppState) => void;

export class ConversationController {
  private state: AppState = { phase: 'idle', result: null, replyIndex: 0 };
  private listeners = new Set<StateListener>();
  private bridge: EvenAppBridge | null = null;
  private pcmChunks: Uint8Array[] = [];
  private transcriber = new GermanTranscriber();

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async initializeGlasses(): Promise<void> {
    this.bridge = await waitForEvenAppBridge();
    const result = await this.bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [
        new TextContainerProperty({
          xPosition: 18,
          yPosition: 18,
          width: 540,
          height: 252,
          containerID: HUD_CONTAINER_ID,
          containerName: HUD_CONTAINER_NAME,
          paddingLength: 8,
          content: hudText(this.state),
          isEventCapture: 1,
        }),
      ],
    }));

    if (result !== StartUpPageCreateResult.success) {
      throw new Error(`G2 page creation failed (${result})`);
    }

    this.bridge.onEvenHubEvent((event) => {
      if (event.audioEvent && this.state.phase === 'listening') {
        this.pcmChunks.push(event.audioEvent.audioPcm);
      }

      const gesture = event.textEvent?.eventType;
      if (gesture === OsEventTypeList.CLICK_EVENT) void this.press();
      if (gesture === OsEventTypeList.DOUBLE_CLICK_EVENT) void this.reset();
      if (gesture === OsEventTypeList.SCROLL_TOP_EVENT) this.swipe(-1);
      if (gesture === OsEventTypeList.SCROLL_BOTTOM_EVENT) this.swipe(1);
    });
    this.transcriber.preload();
  }

  async press(): Promise<void> {
    if (this.state.phase === 'idle' || this.state.phase === 'error') {
      await this.startListening();
      return;
    }
    if (this.state.phase === 'listening') {
      await this.stopAndAnalyze();
      return;
    }
    if (this.state.phase === 'summary') {
      this.setState({ ...this.state, phase: 'replies', replyIndex: 0 });
      return;
    }
    if (this.state.phase === 'replies') {
      this.setState({ ...this.state, phase: 'speak' });
      return;
    }
    if (this.state.phase === 'speak') {
      this.setState({ ...this.state, phase: 'replies' });
    }
  }

  swipe(direction: -1 | 1): void {
    if (this.state.phase === 'summary' && direction === 1) {
      this.setState({ ...this.state, phase: 'replies', replyIndex: 0 });
      return;
    }
    if (this.state.phase !== 'replies' || !this.state.result) return;
    const replyIndex = Math.max(0, Math.min(2, this.state.replyIndex + direction));
    this.setState({ ...this.state, replyIndex });
  }

  async reset(): Promise<void> {
    if (this.state.phase === 'listening') await this.bridge?.audioControl(false);
    this.pcmChunks = [];
    this.setState({ phase: 'idle', result: null, replyIndex: 0 });
  }

  private async startListening(): Promise<void> {
    this.pcmChunks = [];
    this.setState({ phase: 'listening', result: null, replyIndex: 0 });
    if (this.bridge) {
      const opened = await this.bridge.audioControl(true, AudioInputSource.Glasses);
      if (!opened) this.fail('The glasses microphone could not be opened.');
    }
  }

  private async stopAndAnalyze(): Promise<void> {
    await this.bridge?.audioControl(false);
    this.setState({ ...this.state, phase: 'transcribing' });

    try {
      const transcript = await this.transcriber.transcribe(this.pcmChunks);
      if (!transcript.trim()) throw new Error('No German speech was recognized.');
      this.setState({ ...this.state, phase: 'processing' });
      const result = await analyzeConversation({
        transcript,
        conversationLanguage: 'de',
        userLanguage: 'en',
        replyCount: 3,
        priorTurns: [],
      });
      this.setState({ phase: 'summary', result, replyIndex: 0 });
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'Unexpected MundusX error');
    } finally {
      this.pcmChunks = [];
    }
  }

  private fail(errorMessage: string): void {
    this.setState({ phase: 'error', result: null, replyIndex: 0, errorMessage });
  }

  private setState(state: AppState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
    void this.renderGlasses();
  }

  private async renderGlasses(): Promise<void> {
    if (!this.bridge) return;
    await this.bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: HUD_CONTAINER_ID,
      containerName: HUD_CONTAINER_NAME,
      content: hudText(this.state),
    }));
  }
}

export function isEvenAppHost(): boolean {
  return Boolean(
    (window as Window & { flutter_inappwebview?: { callHandler?: unknown } }).flutter_inappwebview?.callHandler,
  );
}
