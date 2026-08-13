import type { AppState } from './types';

const MAX_CONTENT_LINES = 6;
const LINE_WIDTH = 28;

const labeledLines = (label: string, value: string): string[] => {
  const words = value.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const lines: string[] = [];
  let prefix = label;
  let line = prefix;

  for (const word of words) {
    const candidate = line === prefix ? `${prefix}${word}` : `${line} ${word}`;
    if (candidate.length > LINE_WIDTH && line !== prefix) {
      lines.push(line);
      prefix = ' '.repeat(label.length);
      line = `${prefix}${word}`;
    } else {
      line = candidate;
    }
  }
  if (line !== prefix) lines.push(line);
  return lines;
};

const pagesFor = (state: AppState): string[][] => {
  if (!state.result) return [[]];
  const supportive = state.result.replies.find((reply) => reply.kind === 'supportive');
  const neutral = state.result.replies.find((reply) => reply.kind === 'continuation');
  const negative = state.result.replies.find((reply) => reply.kind === 'alternative');

  const lines = state.phase === 'summary'
    ? [
        ...labeledLines('DE>', state.result.heard),
        ...labeledLines('EN>', state.result.translation),
        '',
        ...labeledLines('+DE>', supportive?.text || ''),
        ...labeledLines('+EN>', supportive?.meaning || ''),
      ]
    : state.replyIndex === 1
      ? [
          ...labeledLines('#DE>', neutral?.text || ''),
          ...labeledLines('#EN>', neutral?.meaning || ''),
        ]
      : [
          ...labeledLines('-DE>', negative?.text || ''),
          ...labeledLines('-EN>', negative?.meaning || ''),
        ];

  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += MAX_CONTENT_LINES) {
    pages.push(lines.slice(index, index + MAX_CONTENT_LINES));
  }
  return pages.length ? pages : [[]];
};

export const hudPageCount = (state: AppState): number => pagesFor(state).length;

export function hudText(state: AppState): string {
  if (state.phase === 'idle') return '●';
  if (state.phase === 'listening') return '● DE';
  if (state.phase === 'transcribing') return '… DE';
  if (state.phase === 'processing') return '… AI';
  if (state.phase === 'error') return `! ${state.errorMessage || 'Error'}`;
  if (!state.result) return '●';

  const pages = pagesFor(state);
  const pageIndex = Math.max(0, Math.min(pages.length - 1, state.pageIndex));
  const footer = state.phase === 'summary'
    ? `↓ ${pageIndex + 1}/${pages.length}  # / -`
    : `↑ ↓  ${pageIndex + 1}/${pages.length}`;
  return [...(pages[pageIndex] || []), footer].join('\n');
}
