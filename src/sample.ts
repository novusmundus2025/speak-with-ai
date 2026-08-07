import type { ConversationResult } from './types';

export const germanDinnerSample: ConversationResult = {
  detectedLanguage: 'de',
  speechAct: 'invitation',
  heard: 'Hast du morgen Zeit, gemeinsam etwas essen zu gehen?',
  translation: 'Are you free to get something to eat tomorrow?',
  topic: 'Dinner invitation',
  context: 'Tomorrow · asking availability',
  replies: [
    {
      kind: 'supportive',
      purpose: 'ACCEPT + ASK WHEN',
      text: 'Ja, gerne! Um wie viel Uhr?',
      meaning: 'Yes, gladly! What time?',
    },
    {
      kind: 'continuation',
      purpose: 'CONTINUE THE TOPIC',
      text: 'Wo möchtest du essen gehen?',
      meaning: 'Where would you like to eat?',
    },
    {
      kind: 'alternative',
      purpose: 'POLITELY DECLINE',
      text: 'Leider habe ich morgen keine Zeit.',
      meaning: 'Unfortunately, I am not free tomorrow.',
    },
  ],
};
