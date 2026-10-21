import type { Mode } from './design';

/**
 * Post-task survey. Rules followed (Lab 3): every question is closed, asks about one thing, is worded
 * without leading words, uses the same 5 balanced answer choices of equal range with a neutral middle
 * ("Neither agree nor disagree"), and the problem and target users are defined in docs/STUDY.md.
 * The usability items map to the Lab 2 heuristics.
 */
export const LIKERT = [
  { value: 1, label: 'Strongly disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neither agree nor disagree' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly agree' },
] as const;

export type Dimension = 'satisfaction' | 'engagement' | 'usability';
export type Heuristic =
  'navigation' | 'familiarity' | 'consistency' | 'error' | 'feedback' | 'visual' | 'efficiency';

export interface Item {
  id: string;
  dimension: Dimension;
  heuristic?: Heuristic;
  /** the method is named in the question by the form ("this method") so wording is identical for both */
  text: string;
}

export const ITEMS: readonly Item[] = [
  {
    id: 'sat1',
    dimension: 'satisfaction',
    text: 'I am satisfied with how I wrote the messages with this method.',
  },
  {
    id: 'sat2',
    dimension: 'satisfaction',
    text: 'I would use this method again to write a message.',
  },
  {
    id: 'eng1',
    dimension: 'engagement',
    text: 'I stayed focused on the task while I used this method.',
  },
  { id: 'eng2', dimension: 'engagement', text: 'I found using this method interesting.' },
  {
    id: 'nav1',
    dimension: 'usability',
    heuristic: 'navigation',
    text: 'It was clear what to do next at every step.',
  },
  {
    id: 'fam1',
    dimension: 'usability',
    heuristic: 'familiarity',
    text: 'This method felt familiar to me.',
  },
  {
    id: 'con1',
    dimension: 'usability',
    heuristic: 'consistency',
    text: 'The method worked the same way on every step.',
  },
  {
    id: 'err1',
    dimension: 'usability',
    heuristic: 'error',
    text: 'It was easy to correct a mistake.',
  },
  {
    id: 'fee1',
    dimension: 'usability',
    heuristic: 'feedback',
    text: 'The system showed me straight away what it had understood.',
  },
  {
    id: 'vis1',
    dimension: 'usability',
    heuristic: 'visual',
    text: 'The text on the screen was easy to read.',
  },
  {
    id: 'eff1',
    dimension: 'usability',
    heuristic: 'efficiency',
    text: 'I could finish a message as fast as I wanted to.',
  },
];

export type Answers = Record<string, 1 | 2 | 3 | 4 | 5>;

export const isComplete = (a: Partial<Answers>): a is Answers =>
  ITEMS.every((i) => a[i.id] !== undefined);

/** average per dimension (1..5); null when a dimension has no answers */
export function scores(a: Partial<Answers>): Record<Dimension, number | null> {
  const out: Record<Dimension, number | null> = {
    satisfaction: null,
    engagement: null,
    usability: null,
  };
  for (const d of Object.keys(out) as Dimension[]) {
    const v = ITEMS.filter((i) => i.dimension === d && a[i.id] !== undefined).map(
      (i) => a[i.id] as number,
    );
    out[d] = v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  }
  return out;
}

/** Questions asked once, after both methods. Three choices with a neutral middle. */
export type Preference = Mode | 'same';
export const COMPARISON = [
  { id: 'cmp_easier', text: 'Which method was easier to use for these tasks?' },
  { id: 'cmp_enjoy', text: 'Which method did you enjoy more?' },
  { id: 'cmp_choose', text: 'Which method would you choose to write a message next time?' },
] as const;

/** The two real choices swap sides for every second participant, so position does not favour one method. */
export function comparisonOptions(participant: number): { value: Preference; label: string }[] {
  const camera = { value: 'camera' as const, label: 'Camera hand signs' };
  const keyboard = { value: 'keyboard' as const, label: 'Keyboard and mouse' };
  const same = { value: 'same' as const, label: 'No difference' };
  return participant % 2 === 0 ? [camera, same, keyboard] : [keyboard, same, camera];
}
