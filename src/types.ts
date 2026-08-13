export type ReplyKind = 'supportive' | 'continuation' | 'alternative';

export type SpeechAct =
  | 'question'
  | 'opinion'
  | 'information'
  | 'request'
  | 'invitation'
  | 'complaint'
  | 'greeting'
  | 'emotion'
  | 'clarification'
  | 'other';

export interface SuggestedReply {
  kind: ReplyKind;
  purpose: string;
  text: string;
  meaning: string;
}

export interface ConversationResult {
  detectedLanguage: string;
  speechAct: SpeechAct;
  heard: string;
  translation: string;
  topic: string;
  context: string;
  replies: [SuggestedReply, SuggestedReply, SuggestedReply];
}

export interface ConversationRequest {
  transcript: string;
  conversationLanguage: 'de';
  userLanguage: 'en';
  replyCount: 3;
  priorTurns: Array<{ speaker: 'other' | 'user'; text: string }>;
}

export type AppPhase = 'idle' | 'listening' | 'transcribing' | 'processing' | 'summary' | 'replies' | 'speak' | 'error';

export interface AppState {
  phase: AppPhase;
  result: ConversationResult | null;
  replyIndex: number;
  pageIndex: number;
  errorMessage?: string;
}
