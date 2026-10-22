import type { Place } from '../nlp/words';

/** The two interaction techniques that are compared. */
export type Mode = 'camera' | 'keyboard';
export type TaskSetId = 'A' | 'B';

export interface Task {
  id: string;
  place: Place;
  /** the message to communicate; both words must be in the final sentence for the trial to count as a success */
  words: readonly [string, string];
}

/**
 * Two task sets of equal size that share NO word (not just no whole message), so nobody meets a word
 * again in the second method: no learning effect from the first. Every word is in the context word
 * list AND in the picture-card pack of its place, so both techniques can produce it. Difficulty is
 * matched by letter count, task by task: A = 10, 8, 13 and B = 10, 7, 12 (every pair within 1 letter,
 * totals 31 and 29).
 * Letter counts are only a proxy (typing and signing cost differently), see docs/STUDY.md.
 */
export const TASK_SETS: Record<TaskSetId, readonly Task[]> = {
  A: [
    { id: 'A1', place: 'Clinic', words: ['DOCTOR', 'HELP'] },
    { id: 'A2', place: 'Shop', words: ['PRICE', 'BAG'] },
    { id: 'A3', place: 'Home', words: ['WATER', 'MEDICINE'] },
  ],
  B: [
    { id: 'B1', place: 'Home', words: ['FOOD', 'FAMILY'] },
    { id: 'B2', place: 'Shop', words: ['SIZE', 'PAY'] },
    { id: 'B3', place: 'Work', words: ['MEETING', 'BREAK'] },
  ],
};

export interface Block {
  mode: Mode;
  set: TaskSetId;
}

export interface Plan {
  participant: number;
  /** what the participant does first, then second */
  blocks: readonly [Block, Block];
}

/**
 * Within-subject counterbalancing over 4 participants (a Latin square on mode order x task set):
 *   p mod 4 = 0: camera(A) then keyboard(B)     1: keyboard(A) then camera(B)
 *             2: camera(B) then keyboard(A)     3: keyboard(B) then camera(A)
 * Over any 4 consecutive participants each mode is first twice and each set is used with each mode twice.
 */
export function planFor(participant: number): Plan {
  const p = ((Math.trunc(participant) % 4) + 4) % 4;
  const cameraFirst = p === 0 || p === 2;
  const firstSet: TaskSetId = p < 2 ? 'A' : 'B';
  const secondSet: TaskSetId = firstSet === 'A' ? 'B' : 'A';
  const first: Mode = cameraFirst ? 'camera' : 'keyboard';
  const second: Mode = cameraFirst ? 'keyboard' : 'camera';
  return {
    participant,
    blocks: [
      { mode: first, set: firstSet },
      { mode: second, set: secondSet },
    ],
  };
}

/** a trial succeeds when the final sentence contains every target word (whole words, any case) */
export function isSuccess(task: Task, sentence: string): boolean {
  const have = new Set(sentence.toLowerCase().match(/[a-z']+/g) ?? []);
  return task.words.every((w) => have.has(w.toLowerCase()));
}

export const MODE_LABEL: Record<Mode, string> = {
  camera: 'Camera hand signs',
  keyboard: 'Keyboard and mouse',
};
