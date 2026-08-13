import type { AppState } from './types';

const compact = (value: string, max = 38): string => {
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
};

export function hudText(state: AppState): string {
  if (state.phase === 'idle') return '●';
  if (state.phase === 'listening') return '● DE';
  if (state.phase === 'transcribing') return '… DE';
  if (state.phase === 'processing') return '… AI';
  if (state.phase === 'error') return `! ${compact(state.errorMessage || 'Error')}`;
  if (!state.result) return '●';

  const supportive = state.result.replies.find((reply) => reply.kind === 'supportive');
  const neutral = state.result.replies.find((reply) => reply.kind === 'continuation');
  const negative = state.result.replies.find((reply) => reply.kind === 'alternative');

  if (state.phase === 'summary') {
    return [
      `DE>${compact(state.result.heard)}`,
      `EN>${compact(state.result.translation)}`,
      '',
      `+DE>${compact(supportive?.text || '')}`,
      `+EN>${compact(supportive?.meaning || '')}`,
      '',
      '↓  # / -',
    ].join('\n');
  }

  const reply = state.replyIndex === 1 ? neutral : negative;
  const marker = state.replyIndex === 1 ? '#' : '-';
  return [
    `${marker}DE>${compact(reply?.text || '')}`,
    `${marker}EN>${compact(reply?.meaning || '')}`,
    '',
    '↑  ↓',
  ].join('\n');
}
