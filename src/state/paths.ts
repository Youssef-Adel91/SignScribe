import type { Ev } from './machine';

const cand = (letter: string): Ev => ({
  type: 'LETTER_CANDIDATE',
  candidate: {
    letter,
    confidence: 0.87,
    alternatives: [
      { letter: 'I', confidence: 0.08 },
      { letter: 'T', confidence: 0.03 },
    ],
  },
});
const confirm = (letter: string): Ev[] => [cand(letter), { type: 'LETTER_CONFIRMED', letter }];

const SETUP: Ev[] = [
  { type: 'WAKE' },
  { type: 'CHECKS_PASSED' },
  { type: 'YES' },
  { type: 'YES' },
  { type: 'YES' },
];
const toSpell: Ev[] = SETUP; // welcome -> ... -> 06 spell ready
const toCards: Ev[] = [
  { type: 'WAKE' },
  { type: 'CHECKS_PASSED' },
  { type: 'YES' },
  { type: 'YES' },
  { type: 'CHOOSE_METHOD', method: 'card' },
  { type: 'YES' },
];
const toReview: Ev[] = [
  ...toCards,
  ...['HELLO', 'I', 'NEED', 'DOCTOR'].map((word): Ev => ({ type: 'CARD_ADDED', word })),
  { type: 'YES' },
];

/** Events that take a fresh machine to each screen. Used by the dev simulator and by tests. */
export const PATH_TO_SCREEN: Record<number, Ev[]> = {
  1: [],
  2: [{ type: 'WAKE' }],
  3: [{ type: 'WAKE' }, { type: 'CHECKS_PASSED' }],
  4: [{ type: 'WAKE' }, { type: 'CHECKS_PASSED' }, { type: 'YES' }],
  5: [{ type: 'WAKE' }, { type: 'CHECKS_PASSED' }, { type: 'YES' }, { type: 'YES' }],
  6: toSpell,
  7: [...toSpell, ...confirm('H'), ...confirm('E'), cand('L')],
  8: [...toSpell, ...confirm('H'), ...confirm('E'), ...confirm('L'), { type: 'HAND_LOST' }],
  9: [
    ...toSpell,
    ...confirm('H'),
    ...confirm('E'),
    ...confirm('L'),
    ...confirm('O'),
    { type: 'SPACE' },
  ],
  10: [
    ...toCards,
    { type: 'CARD_ADDED', word: 'I' },
    { type: 'CARD_ADDED', word: 'NEED' },
    { type: 'CARD_CANDIDATE', candidate: { word: 'DOCTOR', confidence: 0.94, trackId: 1 } },
  ],
  11: toReview,
  12: [...toReview, { type: 'YES' }],
  13: [{ type: 'HELP_TOGGLE' }],
};
