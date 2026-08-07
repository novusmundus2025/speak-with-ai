import type { AppState, SuggestedReply } from './types';

const wrap = (value: string, max = 31): string => {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
};

const markerFor = (reply: SuggestedReply): string => {
  if (reply.kind === 'supportive') return '+';
  if (reply.kind === 'alternative') return '-';
  return '›';
};

export function hudText(state: AppState): string {
  if (state.phase === 'idle') {
    return 'SPEAK WITH AI\n\nDEUTSCH  →  ENGLISH\n\nPress to start listening';
  }
  if (state.phase === 'listening') {
    return 'LISTENING  •••\n\nDeutsch detected\n\nPress when they finish';
  }
  if (state.phase === 'processing') {
    return 'MUNDUSX\n\nUnderstanding the conversation…';
  }
  if (state.phase === 'transcribing') {
    return 'LOCAL WHISPER\n\nTranscribing German on this phone…';
  }
  if (state.phase === 'error') {
    return `COULD NOT CONTINUE\n\n${wrap(state.errorMessage || 'Unknown error')}\n\nPress to try again`;
  }
  if (!state.result) return 'SPEAK WITH AI\n\nPress to start listening';

  if (state.phase === 'summary') {
    return `${state.result.topic.toUpperCase()}\n${state.result.context}\n\nEN  ${wrap(state.result.translation, 27)}\n\nSwipe for replies  ↓`;
  }

  const reply = state.result.replies[state.replyIndex];
  if (!reply) return 'No reply available';

  if (state.phase === 'speak') {
    return `SAY\n\n${wrap(reply.text, 27)}\n\nPress to go back`;
  }

  return `${markerFor(reply)}  ${reply.purpose}\n\n${wrap(reply.text, 27)}\n\nEN  ${wrap(reply.meaning, 29)}\n\n↑  ${state.replyIndex + 1} / 3  ↓`;
}
