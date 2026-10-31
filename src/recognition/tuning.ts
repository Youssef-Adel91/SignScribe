import { REJECT_LABEL } from '../config/alphabet';

/**
 * Everything that decides WHEN a letter is shown and written, as settings and not as constants, because a k-NN vote share, a neural
 * network's softmax and an Arabic model do not mean the same by "0.8". There is one set of values per model type and alphabet.
 *
 * THE DEFAULTS BELOW ARE FIRST GUESSES. Nothing here was measured on a real camera. The numbers that matter are found with the debug
 * overlay (`?letterdebug=1`, its log and `ml/calibrate.py`) and then saved from the overlay for that alphabet and model.
 */
export interface LetterTuning {
  /** a guess below this confidence is shown as nothing */
  minConfidence: number;
  /** the written letter needs at least this confidence for the whole hold */
  confirmConfidence: number;
  /** best minus second best must be at least this, else the guess is shown as nothing (0 = off) */
  minMargin: number;
  /** the same letter must be seen this long (ms) before it is shown as a candidate */
  stableMs: number;
  /** ...and this long (ms) before it is written */
  holdMs: number;
  /** after a letter is written the hand must show something else, or move, or leave, for this long (ms) before the next one */
  releaseMs: number;
  /** after a letter is written nothing is shown or written for at least this long (ms) */
  cooldownMs: number;
  /** hand speed (palm lengths per second) above which the hand counts as moving; nothing is classified while it moves */
  maxSpeed: number;
  /** the hand must be still for this many camera frames in a row before it is classified */
  stillFrames: number;
  /** after a command gesture (or the pointer in the command zone) no letter is shown or written for this long (ms) */
  commandHoldoffMs: number;
  /** how often the shown guess is refreshed (ms) */
  refreshMs: number;
  /** a control class (space, done) must be held this long (ms) before it acts: a command should be quicker than a letter */
  controlHoldMs: number;
  /** $1 score needed for a drawn stroke (J, Z, delete, cancel) to count */
  motionMinScore: number;
}

export type ModelType = 'knn' | 'mlp';

/** the values the app had before they became settings; the k-NN vote share is on a scale of its own */
const KNN: LetterTuning = {
  minConfidence: 0.6,
  confirmConfidence: 0.75,
  minMargin: 0.1,
  stableMs: 250,
  holdMs: 800,
  releaseMs: 300,
  cooldownMs: 500,
  maxSpeed: 0.35,
  stillFrames: 4,
  commandHoldoffMs: 600,
  refreshMs: 150,
  controlHoldMs: 500,
  motionMinScore: 0.6,
};

/** a softmax is much more confident than a vote share, also on poses it has never seen: stricter by default, and a longer hold */
const MLP: LetterTuning = {
  ...KNN,
  minConfidence: 0.85,
  confirmConfidence: 0.92,
  holdMs: 900,
  cooldownMs: 700,
  stillFrames: 5,
};

export const DEFAULT_TUNING: Record<ModelType, LetterTuning> = { knn: KNN, mlp: MLP };

/**
 * Per alphabet changes to the model type's defaults. Empty on purpose: nobody has measured a difference yet. An entry here is a
 * decision backed by a calibration table (`ml/calibrate.py`) and a test.
 */
export const ALPHABET_TUNING: Record<
  string,
  Partial<Record<ModelType, Partial<LetterTuning>>>
> = {};

/** the allowed range of each setting: a typo in the overlay cannot make the recogniser fire on everything */
export const RANGES: Record<keyof LetterTuning, [number, number]> = {
  minConfidence: [0.3, 0.99],
  confirmConfidence: [0.3, 0.999],
  minMargin: [0, 0.9],
  stableMs: [50, 2000],
  holdMs: [200, 5000],
  releaseMs: [0, 3000],
  cooldownMs: [0, 5000],
  maxSpeed: [0.05, 5],
  stillFrames: [1, 30],
  commandHoldoffMs: [0, 3000],
  refreshMs: [50, 1000],
  controlHoldMs: [100, 3000],
  motionMinScore: [0.3, 0.99],
};
export const TUNING_KEYS = Object.keys(RANGES) as (keyof LetterTuning)[];

export const modelTypeOf = (id: string | undefined): ModelType => (id === 'mlp' ? 'mlp' : 'knn');

/** keeps only known, finite numbers inside their range; anything else is dropped (the default stays) */
export function sanitize(raw: unknown): Partial<LetterTuning> {
  const out: Partial<LetterTuning> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of TUNING_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    const [lo, hi] = RANGES[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi) out[k] = v;
  }
  return out;
}

/** model type defaults, then the alphabet's changes, then what the person saved for this alphabet and model */
export function resolveTuning(
  alphabetId: string,
  modelId: string | undefined,
  saved: Record<string, unknown> = loadSavedTuning(),
): LetterTuning {
  const type = modelTypeOf(modelId);
  const t = {
    ...DEFAULT_TUNING[type],
    ...sanitize(ALPHABET_TUNING[alphabetId]?.[type]),
    ...sanitize(saved[`${alphabetId}/${type}`]),
  };
  // a letter cannot be written before it is shown, nor with a lower bar than showing it needs
  t.holdMs = Math.max(t.holdMs, t.stableMs + 50);
  t.confirmConfidence = Math.max(t.confirmConfidence, t.minConfidence);
  return t;
}

const KEY = 'signscribe.letterTuning.v1';

export function loadSavedTuning(): Record<string, unknown> {
  try {
    const p: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return p && typeof p === 'object' ? (p as Record<string, unknown>) : {};
  } catch {
    return {}; // blocked or corrupt storage: the defaults are used
  }
}

export function saveTuning(
  alphabetId: string,
  modelId: string | undefined,
  t: Partial<LetterTuning>,
): void {
  try {
    const all = loadSavedTuning();
    all[`${alphabetId}/${modelTypeOf(modelId)}`] = sanitize(t);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function clearSavedTuning(alphabetId: string, modelId: string | undefined): void {
  try {
    const all = loadSavedTuning();
    delete all[`${alphabetId}/${modelTypeOf(modelId)}`];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** the label the model gives to "no letter" (relaxed hand, hand on its way, hand in the command zone): shown as nothing */
export const isRejected = (letter: string): boolean => letter === REJECT_LABEL;

/** the debug overlay saves values; the camera loop listens and applies them from the next frame */
const listeners = new Set<() => void>();
export const onTuningSaved = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const notifyTuningSaved = (): void => {
  for (const l of listeners) l();
};
