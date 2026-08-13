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
  private browserAudioChunks: Float32Array[] = [];
  private browserAudioContext: AudioContext | null = null;
  private browserAudioStream: MediaStream | null = null;
  private browserAudioProcessor: ScriptProcessorNode | null = null;
  private browserAudioSource: MediaStreamAudioSourceNode | null = null;
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
      this.speakSelectedReply();
      return;
    }
    if (this.state.phase === 'speak') {
      this.setState({ ...this.state, phase: 'replies' });
    }
  }

  swipe(direction: -1 | 1): void {
    if (this.state.phase === 'summary' && direction === 1) {
      this.setState({ ...this.state, phase: 'replies', replyIndex: 1 });
      return;
    }
    if (this.state.phase !== 'replies' || !this.state.result) return;
    if (this.state.replyIndex === 1 && direction === -1) {
      this.setState({ ...this.state, phase: 'summary', replyIndex: 0 });
      return;
    }
    const replyIndex = Math.max(1, Math.min(2, this.state.replyIndex + direction));
    this.setState({ ...this.state, replyIndex });
  }

  async reset(): Promise<void> {
    if (this.state.phase === 'listening') await this.bridge?.audioControl(false);
    await this.stopBrowserMicrophone();
    window.speechSynthesis?.cancel();
    this.pcmChunks = [];
    this.setState({ phase: 'idle', result: null, replyIndex: 0 });
  }

  private async startListening(): Promise<void> {
    this.pcmChunks = [];
    this.setState({ phase: 'listening', result: null, replyIndex: 0 });
    if (this.bridge) {
      const opened = await this.bridge.audioControl(true, AudioInputSource.Glasses);
      if (!opened) this.fail('The glasses microphone could not be opened.');
    } else {
      try {
        await this.startBrowserMicrophone();
      } catch (error) {
        this.fail(error instanceof Error ? error.message : 'The laptop microphone could not be opened.');
      }
    }
  }

  private async stopAndAnalyze(): Promise<void> {
    await this.bridge?.audioControl(false);
    if (!this.bridge) await this.stopBrowserMicrophone();
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

  private async startBrowserMicrophone(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone capture.');
    }

    this.browserAudioChunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (this.state.phase !== 'listening') return;
      this.browserAudioChunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };
    source.connect(processor);
    processor.connect(context.destination);
    this.browserAudioStream = stream;
    this.browserAudioContext = context;
    this.browserAudioSource = source;
    this.browserAudioProcessor = processor;
  }

  private async stopBrowserMicrophone(): Promise<void> {
    const context = this.browserAudioContext;
    this.browserAudioProcessor?.disconnect();
    this.browserAudioSource?.disconnect();
    this.browserAudioStream?.getTracks().forEach((track) => track.stop());
    this.browserAudioProcessor = null;
    this.browserAudioSource = null;
    this.browserAudioStream = null;
    this.browserAudioContext = null;

    if (context && this.browserAudioChunks.length > 0) {
      const audio = joinFloat32(this.browserAudioChunks);
      const resampled = resampleLinear(audio, context.sampleRate, 16_000);
      this.pcmChunks = [float32ToPcm16Le(resampled)];
    }
    this.browserAudioChunks = [];
    if (context && context.state !== 'closed') await context.close();
  }

  private speakSelectedReply(): void {
    if (this.bridge || !this.state.result || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const selectedReply = this.state.result.replies[this.state.replyIndex];
    if (!selectedReply) return;
    const utterance = new SpeechSynthesisUtterance(selectedReply.text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
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

function joinFloat32(chunks: Float32Array[]): Float32Array {
  const joined = new Float32Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }
  return joined;
}

function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (input.length === 0) return input;
  if (sourceRate === targetRate) return input;
  const outputLength = Math.max(1, Math.round(input.length * targetRate / sourceRate));
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    const leftSample = input[left] ?? 0;
    const rightSample = input[right] ?? leftSample;
    output[index] = leftSample * (1 - fraction) + rightSample * fraction;
  }
  return output;
}

function float32ToPcm16Le(input: Float32Array): Uint8Array {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    view.setInt16(index * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return bytes;
}

export function isEvenAppHost(): boolean {
  return Boolean(
    (window as Window & { flutter_inappwebview?: { callHandler?: unknown } }).flutter_inappwebview?.callHandler,
  );
}
