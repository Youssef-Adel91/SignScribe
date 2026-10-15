import { and, assign, setup } from 'xstate';
import { closestMatch, isKnownWord } from '../nlp/dictionary';
import { offlineSentence } from '../nlp/sentence';
import type { Place } from '../nlp/words';

/* ---------- types ---------- */

export type Hand = 'left' | 'right';
export type Alphabet = 'arabic' | 'english' | 'more';
export type Display = 'standard' | 'large' | 'contrast';
export type Method = 'spell' | 'card';
export type Overlay = 'none' | 'handLost' | 'help';

/** Alphabets that currently have a label set + model. Others are shown as "Coming soon". */
export const AVAILABLE_ALPHABETS: readonly Alphabet[] = ['english'];

export interface Candidate {
  letter: string;
  confidence: number; // 0..1
  alternatives: { letter: string; confidence: number }[];
}

export interface CardCandidate {
  word: string;
  confidence: number; // 0..1
  trackId: number;
}

export interface Suggestion {
  original: string;
  match: string;
}

export interface Settings {
  hand: Hand;
  alphabet: Alphabet;
  display: Display;
}

export interface Ctx extends Settings {
  place: Place;
  method: Method;
  /** letters of the word being spelt */
  word: string;
  /** finished words (spelt or from picture cards) */
  words: string[];
  candidate: Candidate | null;
  suggestion: Suggestion | null;
  /** picture card currently held in front of the camera, not yet added */
  cardCandidate: CardCandidate | null;
  /** where to go once a word suggestion is resolved */
  afterWord: 'spell' | 'review';
  sentence: string;
  sentenceAttempt: number;
  sentenceConfirmed: boolean;
  overlay: Overlay;
  /** overlay to return to when help closes */
  overlayBefore: Overlay;
}

export type Ev =
  | { type: 'WAKE' }
  | { type: 'CHECKS_PASSED' }
  | { type: 'CHOOSE_HAND'; hand: Hand }
  | { type: 'CHOOSE_ALPHABET'; alphabet: Alphabet }
  | { type: 'CHOOSE_DISPLAY'; display: Display }
  | { type: 'CHOOSE_CONTEXT'; place: Place }
  | { type: 'CHOOSE_METHOD'; method: Method }
  | { type: 'LETTER_CANDIDATE'; candidate: Candidate }
  | { type: 'CANDIDATE_LOST' }
  | { type: 'LETTER_CONFIRMED'; letter: string }
  | { type: 'SPACE' }
  | { type: 'DELETE' }
  | { type: 'WORD_ACCEPT' }
  | { type: 'WORD_REJECT' }
  | { type: 'CARD_CANDIDATE'; candidate: CardCandidate }
  | { type: 'CARD_LOST' }
  | { type: 'CARD_ADDED'; word: string }
  | { type: 'YES' }
  | { type: 'NO' }
  | { type: 'HAND_LOST' }
  | { type: 'HAND_BACK' }
  | { type: 'HELP_TOGGLE' }
  | { type: 'FINISH' }
  | { type: 'NEW_SENTENCE' }
  | { type: 'EDIT' };

export const DEFAULT_SETTINGS: Settings = {
  hand: 'right',
  alphabet: 'english',
  display: 'standard',
};

/* ---------- pure helpers ---------- */

type Wrapped = { context: Ctx };

const wordIsEmpty = ({ context }: Wrapped) => context.word.length === 0;
/** spelt word that is not in the context list AND has a close list match -> screen 09 */
const needsSuggestion = ({ context }: Wrapped) =>
  context.word.length > 0 &&
  !isKnownWord(context.word, context.place) &&
  closestMatch(context.word, context.place) !== null;
const hasWords = ({ context }: Wrapped) => context.words.length > 0;
const wordsAfterPush = ({ context }: Wrapped) => context.words.length + (context.word ? 1 : 0) > 0;
const isIdle = ({ context }: Wrapped) => context.overlay === 'none';

/* ---------- machine ---------- */

export const signScribeMachine = setup({
  types: {
    context: {} as Ctx,
    events: {} as Ev,
    input: {} as Partial<Settings> | undefined,
  },
  guards: {
    idle: isIdle,
    helpOpen: ({ context }) => context.overlay === 'help',
    handLostOpen: ({ context }) => context.overlay === 'handLost',
    helpOverHandLost: ({ context }) =>
      context.overlay === 'help' && context.overlayBefore === 'handLost',
    wordEmpty: wordIsEmpty,
    needsSuggestion,
    hasWords,
    wordsAfterPush,
    alphabetAvailable: ({ event }) =>
      event.type === 'CHOOSE_ALPHABET' && AVAILABLE_ALPHABETS.includes(event.alphabet),
    methodIsCard: ({ context }) => context.method === 'card',
    chosenIsCard: ({ event }) => event.type === 'CHOOSE_METHOD' && event.method === 'card',
    candidateExists: ({ context }) => context.candidate !== null,
    oneWordLeft: ({ context }) => context.words.length <= 1,
  },
  actions: {
    setHand: assign(({ event }) => (event.type === 'CHOOSE_HAND' ? { hand: event.hand } : {})),
    setAlphabet: assign(({ event }) =>
      event.type === 'CHOOSE_ALPHABET' ? { alphabet: event.alphabet } : {},
    ),
    setDisplay: assign(({ event }) =>
      event.type === 'CHOOSE_DISPLAY' ? { display: event.display } : {},
    ),
    setPlace: assign(({ event }) =>
      event.type === 'CHOOSE_CONTEXT' ? { place: event.place } : {},
    ),
    setMethod: assign(({ event }) =>
      event.type === 'CHOOSE_METHOD' ? { method: event.method } : {},
    ),
    setCandidate: assign(({ event }) =>
      event.type === 'LETTER_CANDIDATE' ? { candidate: event.candidate } : {},
    ),
    clearCandidate: assign({ candidate: null }),
    appendLetter: assign(({ context, event }) =>
      event.type === 'LETTER_CONFIRMED'
        ? { word: context.word + event.letter.toUpperCase().slice(0, 1), candidate: null }
        : {},
    ),
    /** delete the last letter; with no letters left, take back the last finished word */
    deleteLast: assign(({ context }) => {
      if (context.word.length > 0) return { word: context.word.slice(0, -1), candidate: null };
      if (context.words.length > 0) return { words: context.words.slice(0, -1), candidate: null };
      return {};
    }),
    pushWord: assign(({ context }) => ({
      words: context.word ? [...context.words, context.word] : context.words,
      word: '',
      candidate: null,
    })),
    prepareSuggestion: assign(({ context }) => ({
      suggestion: {
        original: context.word,
        match: closestMatch(context.word, context.place) ?? context.word,
      },
      candidate: null,
    })),
    afterSpace: assign({ afterWord: 'spell' as const }),
    afterDone: assign({ afterWord: 'review' as const }),
    acceptSuggestion: assign(({ context }) => ({
      words: [...context.words, context.suggestion ? context.suggestion.match : context.word],
      word: '',
      suggestion: null,
    })),
    rejectSuggestion: assign(({ context }) => ({
      words: [...context.words, context.suggestion ? context.suggestion.original : context.word],
      word: '',
      suggestion: null,
    })),
    /** "Delete letters" on screen 09: put the word back and drop its last letter */
    reopenWord: assign(({ context }) => ({
      word: (context.suggestion?.original ?? context.word).slice(0, -1),
      suggestion: null,
    })),
    setCardCandidate: assign(({ event }) =>
      event.type === 'CARD_CANDIDATE' ? { cardCandidate: event.candidate } : {},
    ),
    clearCardCandidate: assign({ cardCandidate: null }),
    addCard: assign(({ context, event }) =>
      event.type === 'CARD_ADDED'
        ? { words: [...context.words, event.word.toUpperCase()], cardCandidate: null }
        : {},
    ),
    dropLastWord: assign(({ context }) => ({ words: context.words.slice(0, -1) })),
    clearMessage: assign({
      word: '',
      words: [],
      candidate: null,
      cardCandidate: null,
      suggestion: null,
      sentence: '',
      sentenceAttempt: 0,
      sentenceConfirmed: false,
    }),
    resetSession: assign({
      word: '',
      words: [],
      candidate: null,
      cardCandidate: null,
      suggestion: null,
      sentence: '',
      sentenceAttempt: 0,
      sentenceConfirmed: false,
      overlay: 'none' as const,
      overlayBefore: 'none' as const,
    }),
    computeSentence: assign(({ context }) => ({
      sentence: offlineSentence(context.words, context.place, 0),
      sentenceAttempt: 0,
      sentenceConfirmed: false,
    })),
    tryAnother: assign(({ context }) => ({
      sentenceAttempt: context.sentenceAttempt + 1,
      sentence: offlineSentence(context.words, context.place, context.sentenceAttempt + 1),
    })),
    confirmSentence: assign({ sentenceConfirmed: true }),
    unconfirmSentence: assign({ sentenceConfirmed: false }),
    handLost: assign({ overlay: 'handLost' as const }),
    handBack: assign({ overlay: 'none' as const }),
    handLostBehindHelp: assign({ overlayBefore: 'handLost' as const }),
    handBackBehindHelp: assign({ overlayBefore: 'none' as const }),
    toggleHelp: assign(({ context }) =>
      context.overlay === 'help'
        ? { overlay: context.overlayBefore, overlayBefore: 'none' as const }
        : { overlay: 'help' as const, overlayBefore: context.overlay },
    ),
  },
}).createMachine({
  id: 'signscribe',
  context: ({ input }): Ctx => ({
    ...DEFAULT_SETTINGS,
    ...input,
    place: 'Clinic',
    method: 'spell',
    word: '',
    words: [],
    candidate: null,
    suggestion: null,
    cardCandidate: null,
    afterWord: 'spell',
    sentence: '',
    sentenceAttempt: 0,
    sentenceConfirmed: false,
    overlay: 'none',
    overlayBefore: 'none',
  }),
  initial: 'welcome',
  // Overlay events that work from every state. Child states guard on `idle`, so when an overlay is
  // open their handlers do not fire and the event bubbles up to these.
  on: {
    HELP_TOGGLE: { actions: 'toggleHelp' },
    NO: { guard: 'helpOpen', actions: 'toggleHelp' },
    HAND_BACK: [
      { guard: 'handLostOpen', actions: 'handBack' },
      { guard: 'helpOverHandLost', actions: 'handBackBehindHelp' },
    ],
  },
  states: {
    /* 01 */ welcome: {
      on: { WAKE: { guard: 'idle', target: 'cameraCheck' } },
    },
    /* 02 */ cameraCheck: {
      on: {
        CHECKS_PASSED: { guard: 'idle', target: 'preferences' },
        NO: { guard: 'idle', target: 'welcome' },
      },
    },
    /* 03 */ preferences: {
      on: {
        CHOOSE_HAND: { guard: 'idle', actions: 'setHand' },
        CHOOSE_ALPHABET: { guard: and(['idle', 'alphabetAvailable']), actions: 'setAlphabet' },
        CHOOSE_DISPLAY: { guard: 'idle', actions: 'setDisplay' },
        YES: { guard: 'idle', target: 'context' },
        NO: { guard: 'idle', target: 'cameraCheck' },
      },
    },
    /* 04 */ context: {
      on: {
        CHOOSE_CONTEXT: { guard: 'idle', actions: 'setPlace' },
        YES: { guard: 'idle', target: 'method' },
        NO: { guard: 'idle', target: 'preferences' },
      },
    },
    /* 05 */ method: {
      on: {
        CHOOSE_METHOD: { guard: 'idle', actions: 'setMethod' },
        YES: [
          { guard: and(['idle', 'methodIsCard']), target: 'cards' },
          { guard: 'idle', target: 'spell' },
        ],
        NO: { guard: 'idle', target: 'context' },
      },
    },
    /* 06 / 07 */ spell: {
      initial: 'ready',
      on: {
        HAND_LOST: [
          { guard: 'helpOpen', actions: 'handLostBehindHelp' },
          { guard: 'idle', actions: 'handLost' },
        ],
        DELETE: { guard: 'idle', actions: 'deleteLast', target: '.ready' },
        SPACE: [
          { guard: and(['idle', 'wordEmpty']), target: '.ready', actions: 'clearCandidate' },
          {
            guard: and(['idle', 'needsSuggestion']),
            target: 'wordSuggestion',
            actions: ['afterSpace', 'prepareSuggestion'],
          },
          { guard: 'idle', target: '.ready', actions: 'pushWord' },
        ],
        YES: [
          {
            guard: and(['idle', 'needsSuggestion']),
            target: 'wordSuggestion',
            actions: ['afterDone', 'prepareSuggestion'],
          },
          {
            guard: and(['idle', 'wordsAfterPush']),
            target: 'review',
            actions: ['pushWord', 'computeSentence'],
          },
        ],
      },
      states: {
        ready: {
          on: {
            LETTER_CANDIDATE: { guard: 'idle', target: 'recognizing', actions: 'setCandidate' },
            NO: { guard: 'idle', target: '#signscribe.method' },
          },
        },
        recognizing: {
          on: {
            LETTER_CANDIDATE: { guard: 'idle', actions: 'setCandidate' },
            LETTER_CONFIRMED: { guard: 'idle', target: 'ready', actions: 'appendLetter' },
            CANDIDATE_LOST: { guard: 'idle', target: 'ready', actions: 'clearCandidate' },
            NO: { guard: 'idle', target: 'ready', actions: 'clearCandidate' },
          },
        },
      },
    },
    /* 09 */ wordSuggestion: {
      on: {
        HAND_LOST: [
          { guard: 'helpOpen', actions: 'handLostBehindHelp' },
          { guard: 'idle', actions: 'handLost' },
        ],
        WORD_ACCEPT: [
          {
            guard: and(['idle', ({ context }) => context.afterWord === 'review']),
            target: 'review',
            actions: ['acceptSuggestion', 'computeSentence'],
          },
          { guard: 'idle', target: 'spell', actions: 'acceptSuggestion' },
        ],
        YES: [
          {
            guard: and(['idle', ({ context }) => context.afterWord === 'review']),
            target: 'review',
            actions: ['acceptSuggestion', 'computeSentence'],
          },
          { guard: 'idle', target: 'spell', actions: 'acceptSuggestion' },
        ],
        WORD_REJECT: [
          {
            guard: and(['idle', ({ context }) => context.afterWord === 'review']),
            target: 'review',
            actions: ['rejectSuggestion', 'computeSentence'],
          },
          { guard: 'idle', target: 'spell', actions: 'rejectSuggestion' },
        ],
        NO: [
          {
            guard: and(['idle', ({ context }) => context.afterWord === 'review']),
            target: 'review',
            actions: ['rejectSuggestion', 'computeSentence'],
          },
          { guard: 'idle', target: 'spell', actions: 'rejectSuggestion' },
        ],
        DELETE: { guard: 'idle', target: 'spell', actions: 'reopenWord' },
      },
    },
    /* 10 */ cards: {
      on: {
        HAND_LOST: [
          { guard: 'helpOpen', actions: 'handLostBehindHelp' },
          { guard: 'idle', actions: 'handLost' },
        ],
        CARD_CANDIDATE: { guard: 'idle', actions: 'setCardCandidate' },
        CARD_LOST: { guard: 'idle', actions: 'clearCardCandidate' },
        CARD_ADDED: { guard: 'idle', actions: 'addCard' },
        YES: { guard: and(['idle', 'hasWords']), target: 'review', actions: 'computeSentence' },
        DELETE: { guard: 'idle', actions: 'dropLastWord' },
        NO: { guard: 'idle', target: 'method' },
      },
    },
    /* 11 */ review: {
      on: {
        YES: { guard: 'idle', target: 'share', actions: 'confirmSentence' },
        NO: { guard: 'idle', actions: 'tryAnother' },
        DELETE: [
          { guard: and(['idle', 'oneWordLeft']), target: 'method', actions: 'clearMessage' },
          { guard: 'idle', actions: ['dropLastWord', 'computeSentence'] },
        ],
        // "Need to add more? Show a card or spell a word." keeps the words already collected.
        CHOOSE_METHOD: [
          { guard: and(['idle', 'chosenIsCard']), target: 'cards', actions: 'setMethod' },
          { guard: 'idle', target: 'spell', actions: 'setMethod' },
        ],
      },
    },
    /* 12 */ share: {
      on: {
        FINISH: { guard: 'idle', target: 'welcome', actions: 'resetSession' },
        NEW_SENTENCE: { guard: 'idle', target: 'method', actions: 'clearMessage' },
        EDIT: { guard: 'idle', target: 'review', actions: 'unconfirmSentence' },
        NO: { guard: 'idle', target: 'review', actions: 'unconfirmSentence' },
      },
    },
  },
});

/* ---------- derived view ---------- */

/** Screen number 1-13 for a snapshot: overlays win over the underlying state. */
export function screenOf(value: unknown, ctx: Pick<Ctx, 'overlay'>): number {
  if (ctx.overlay === 'help') return 13;
  if (ctx.overlay === 'handLost') return 8;
  if (typeof value === 'object' && value !== null && 'spell' in value) {
    return (value as { spell: string }).spell === 'recognizing' ? 7 : 6;
  }
  switch (value) {
    case 'welcome':
      return 1;
    case 'cameraCheck':
      return 2;
    case 'preferences':
      return 3;
    case 'context':
      return 4;
    case 'method':
      return 5;
    case 'wordSuggestion':
      return 9;
    case 'cards':
      return 10;
    case 'review':
      return 11;
    case 'share':
      return 12;
    default:
      return 1;
  }
}

export const SCREEN_NAMES = [
  'Welcome',
  'Camera check',
  'Preferences',
  'Context',
  'Method',
  'Spell ready',
  'Spell recognizing',
  'Hand lost',
  'Word suggestion',
  'Picture card',
  'Review sentence',
  'Share',
  'Gesture guide',
] as const;
