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

  return [
    `Q ${compact(state.result.heard)}`,
    `  ${compact(state.result.translation)}`,
    `+ ${compact(supportive?.text || '')}`,
    `  ${compact(supportive?.meaning || '')}`,
    `- ${compact(negative?.text || '')}`,
    `  ${compact(negative?.meaning || '')}`,
    `# ${compact(neutral?.text || '')}`,
    `  ${compact(neutral?.meaning || '')}`,
  ].join('\n');
}
