import { LIKERT } from './survey';

/**
 * Background questions, asked once before the tasks. Closed, one idea each, answer choices of equal
 * range with a neutral middle where there is a scale (Lab 3). Nothing here identifies a person: the
 * participant is a number. "Prefer not to say" is always possible for age. Participants must be 18 or
 * older (consent line), so there is no age option below 18.
 */
export interface ProfileItem {
  id: string;
  text: string;
  options: { value: string; label: string }[];
}

export const PROFILE: readonly ProfileItem[] = [
  {
    id: 'age',
    text: 'Which age group are you in?',
    options: [
      { value: '18-24', label: '18 to 24' },
      { value: '25-34', label: '25 to 34' },
      { value: '35-44', label: '35 to 44' },
      { value: '45+', label: '45 or older' },
      { value: 'na', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'writing_hand',
    text: 'Which hand do you write with?',
    options: [
      { value: 'right', label: 'Right' },
      { value: 'left', label: 'Left' },
      { value: 'both', label: 'Both equally' },
    ],
  },
  {
    id: 'sign_language',
    text: 'How much sign language do you know?',
    options: [
      { value: 'none', label: 'None' },
      { value: 'few', label: 'A few signs or letters' },
      { value: 'conversation', label: 'I can have a simple conversation' },
      { value: 'daily', label: 'I use it every day' },
    ],
  },
  {
    id: 'gesture_ui',
    text: 'How often have you used a camera or gesture-controlled interface before?',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'once', label: 'Once or twice' },
      { value: 'several', label: 'Three to ten times' },
      { value: 'often', label: 'More than ten times' },
    ],
  },
  {
    id: 'kbm',
    text: 'I am comfortable using a keyboard and a mouse.',
    options: LIKERT.map((l) => ({ value: String(l.value), label: l.label })),
  },
];

export type ProfileAnswers = Record<string, string>;

export const profileComplete = (a: Partial<ProfileAnswers>): a is ProfileAnswers =>
  PROFILE.every((q) => a[q.id] !== undefined && q.options.some((o) => o.value === a[q.id]));

export const CONSENT_TEXT =
  'The participant is 18 or older, has read or heard the information sheet (docs/STUDY.md), agrees to take part, knows that the data are anonymous (a number, no name, no pictures), and that they can stop at any time.';

/** the computer and settings a session ran on, so results can be read in context */
export interface SessionMeta {
  participant: number;
  startedAt: number;
  appVersion: string;
  userAgent: string;
  screen: string;
  cores: number | null;
  textSize: string;
  contrast: string;
  dwell: string;
  voice: boolean;
  signingHand: string;
}
