import './style.css';
import { ConversationController, isEvenAppHost } from './controller';
import { hudText } from './hud';
import { mundusxMode } from './mundusx';
import { transcriptionMode } from './transcription';
import type { AppState } from './types';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('App root not found');

root.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Speak with AI home">
        <span class="brand-mark">M</span>
        <span>Speak with AI</span>
      </a>
      <span class="mode"><i></i> Whisper <b>${transcriptionMode}</b> · MundusX <b>${mundusxMode}</b></span>
    </header>

    <section class="intro">
      <p class="eyebrow">EVEN G2 · DEUTSCH PROTOTYPE</p>
      <h1>Understand the moment.<br><em>Answer naturally.</em></h1>
      <p class="lede">A glasses-first translation assistant that explains what was said, what it is about, and three replies you can confidently speak.</p>
    </section>

    <section class="workspace" aria-label="G2 interaction simulator">
      <div class="glasses-stage">
        <div class="glasses" aria-hidden="true">
          <span class="arm arm-left"></span>
          <span class="arm arm-right"></span>
          <div class="lens lens-left"><div class="hud"><pre id="hud-text"></pre></div></div>
          <div class="bridge"></div>
          <div class="lens lens-right"><div class="hud hud-reflection"><pre id="hud-copy"></pre></div></div>
        </div>
        <div class="status-line"><span id="phase-dot"></span><span id="phase-label">Ready</span></div>
      </div>

      <aside class="control-panel">
        <div>
          <p class="panel-kicker">TOUCHPAD</p>
          <h2>Try the conversation flow</h2>
        </div>
        <button class="primary" id="press-button" type="button"><span>●</span><b>Press</b><small>start listening</small></button>
        <div class="gesture-row">
          <button id="swipe-up" type="button"><span>↑</span><small>Swipe up</small></button>
          <button id="swipe-down" type="button"><span>↓</span><small>Swipe down</small></button>
        </div>
        <button class="reset" id="reset-button" type="button">Double-press · reset</button>
        <p class="hint" id="interaction-hint">Press once to begin a real conversation using this laptop's microphone.</p>
      </aside>
    </section>

    <footer>
      <span>DE conversation</span><span>EN understanding</span><span>3 contextual replies</span>
    </footer>
  </main>
`;

const controller = new ConversationController();
const hud = document.querySelector<HTMLPreElement>('#hud-text');
const hudCopy = document.querySelector<HTMLPreElement>('#hud-copy');
const phaseLabel = document.querySelector<HTMLSpanElement>('#phase-label');
const phaseDot = document.querySelector<HTMLSpanElement>('#phase-dot');
const pressButton = document.querySelector<HTMLButtonElement>('#press-button');
const interactionHint = document.querySelector<HTMLParagraphElement>('#interaction-hint');

const labels: Record<AppState['phase'], string> = {
  idle: 'Ready',
  listening: 'Listening',
  transcribing: 'Transcribing locally',
  processing: 'Thinking',
  summary: 'Meaning',
  replies: 'Choose a reply',
  speak: 'Speak',
  error: 'Needs attention',
};

const hints: Record<AppState['phase'], string> = {
  idle: 'Press once to begin. On a laptop, allow microphone access when asked.',
  listening: 'Speak German near the laptop microphone. Press when the other person finishes.',
  transcribing: 'Whisper is converting the captured audio to German text locally on this device.',
  processing: 'MundusX is extracting the translation, topic, and reply intentions.',
  summary: 'First understand what the message is about. Swipe down to see suggested replies.',
  replies: 'Swipe between positive, contextual, and negative. Press to enlarge the selected German reply.',
  speak: 'The selected German reply is spoken through the laptop speakers. Press to return.',
  error: 'Press to try the conversation again.',
};

controller.subscribe((state) => {
  const content = hudText(state);
  if (hud) hud.textContent = content;
  if (hudCopy) hudCopy.textContent = content;
  if (phaseLabel) phaseLabel.textContent = labels[state.phase];
  if (phaseDot) phaseDot.dataset.phase = state.phase;
  if (interactionHint) interactionHint.textContent = hints[state.phase];
  if (pressButton) {
    const detail = pressButton.querySelector('small');
    if (detail) {
      detail.textContent = state.phase === 'listening' ? 'finish listening' : state.phase === 'replies' ? 'show speaking view' : 'select';
    }
  }
});

document.querySelector('#press-button')?.addEventListener('click', () => void controller.press());
document.querySelector('#swipe-up')?.addEventListener('click', () => controller.swipe(-1));
document.querySelector('#swipe-down')?.addEventListener('click', () => controller.swipe(1));
document.querySelector('#reset-button')?.addEventListener('click', () => void controller.reset());

if (isEvenAppHost()) {
  void controller.initializeGlasses().catch((error: unknown) => {
    console.error('Could not initialize G2:', error);
  });
}
