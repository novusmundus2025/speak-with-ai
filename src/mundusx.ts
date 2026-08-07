import { germanDinnerSample } from './sample';
import type { ConversationRequest, ConversationResult, SuggestedReply } from './types';

const baseUrl = (import.meta.env.VITE_MUNDUSX_API_URL || 'https://mundusx.ai').replace(/\/$/, '');
const useMock = import.meta.env.VITE_USE_MOCK_MUNDUSX !== 'false';

const isReply = (value: unknown): value is SuggestedReply => {
  if (!value || typeof value !== 'object') return false;
  const reply = value as Record<string, unknown>;
  return (
    ['supportive', 'continuation', 'alternative'].includes(String(reply.kind)) &&
    typeof reply.purpose === 'string' &&
    typeof reply.text === 'string' &&
    typeof reply.meaning === 'string'
  );
};

const isConversationResult = (value: unknown): value is ConversationResult => {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.detectedLanguage === 'string' &&
    typeof result.speechAct === 'string' &&
    typeof result.heard === 'string' &&
    typeof result.translation === 'string' &&
    typeof result.topic === 'string' &&
    typeof result.context === 'string' &&
    Array.isArray(result.replies) &&
    result.replies.length === 3 &&
    result.replies.every(isReply)
  );
};

export async function analyzeConversation(request: ConversationRequest): Promise<ConversationResult> {
  if (useMock) {
    await new Promise((resolve) => window.setTimeout(resolve, 850));
    return germanDinnerSample;
  }

  const response = await fetch(`${baseUrl}/api/glasses/conversation`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`MundusX request failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!isConversationResult(payload)) {
    throw new Error('MundusX returned an unsupported response shape');
  }

  return payload;
}

export const mundusxMode = useMock ? 'mock' : 'live';
