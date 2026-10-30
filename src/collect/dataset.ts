/**
 * The dataset format written by the collection mode (`/?collect=1`) and read by ml/. One JSON object
 * per line ("JSONL"), one TAKE per object. Documented in docs/DATASET.md; ml/signscribe_ml/dataset.py
 * checks the same rules.
 */
import { ALPHABET, ALPHABET_LABELS } from '../config/alphabet';

export type TakeKind = 'static' | 'dynamic';
export type SigningHand = 'left' | 'right';

export interface TakeFrame {
  /** ms since the first frame of the take */
  t: number;
  /** 21 MediaPipe landmarks [x, y, z], x and y normalised 0..1 of the un-mirrored frame */
  lm: [number, number, number][];
}

export interface Take {
  v: 1;
  id: string;
  /** one label of the active alphabet (config/alphabets) */
  label: string;
  kind: TakeKind;
  /** who signed: an anonymous code such as "s01" (never a name) */
  signer: string;
  /** one sitting: same light, distance and camera. Free text such as "lamp-60cm" */
  session: string;
  /** the signing-hand setting while recording: left-handed takes are mirrored when features are made */
  hand: SigningHand;
  /** video size in pixels (x and y are normalised separately) */
  width: number;
  height: number;
  createdAt: string;
  /** who is in the pictures, when the dataset says (imported pictures). Whole persons are held out when testing */
  person?: string;
  /** which recording/sub-dataset the take comes from; used instead of `person` when the dataset has no person ids */
  source?: string;
  /** true only for generated test data */
  synthetic?: boolean;
  frames: TakeFrame[];
}

/** every label of the active alphabet; see src/config/alphabet.ts */
export const LETTERS: readonly string[] = ALPHABET_LABELS;
/** labels that are drawn in the air (J and Z in ASL): recorded as dynamic takes by default */
export const MOVING_LETTERS: readonly string[] = ALPHABET.dynamic;
export const defaultKind = (label: string): TakeKind =>
  MOVING_LETTERS.includes(label) ? 'dynamic' : 'static';

export class TakeError extends Error {}

/** the same rules as ml/signscribe_ml/dataset.py:parse_take */
export function validateTake(raw: unknown): Take {
  const t = raw as Partial<Take> | null;
  const fail = (m: string): never => {
    throw new TakeError(m);
  };
  if (!t || typeof t !== 'object') return fail('a take must be an object');
  if (t.v !== 1) fail("unsupported or missing version 'v' (expected 1)");
  for (const k of [
    'id',
    'label',
    'kind',
    'signer',
    'session',
    'hand',
    'width',
    'height',
    'frames',
  ] as const)
    if (!(k in t)) fail(`missing field '${k}'`);
  if (t.kind !== 'static' && t.kind !== 'dynamic') fail("kind must be 'static' or 'dynamic'");
  if (t.hand !== 'left' && t.hand !== 'right') fail("hand must be 'left' or 'right'");
  if (typeof t.label !== 'string' || !LETTERS.includes(t.label))
    fail(`label must be one letter of the alphabet (${LETTERS.join(' ')})`);
  for (const k of ['person', 'source'] as const)
    if (k in t && (typeof t[k] !== 'string' || t[k]!.trim() === ''))
      fail(`'${k}' must be a non-empty string`);
  if (!((t.width as number) > 0 && (t.height as number) > 0))
    fail('width and height must be positive');
  const frames = t.frames;
  if (!Array.isArray(frames) || frames.length < 1) return fail('a take needs at least one frame');
  if (t.kind === 'dynamic' && frames.length < 5) fail('a dynamic take needs at least 5 frames');
  let last = -Infinity;
  for (const f of frames) {
    if (!Array.isArray(f.lm) || f.lm.length !== 21) fail('every frame needs 21 landmarks');
    for (const p of f.lm)
      if (
        !Array.isArray(p) ||
        p.length !== 3 ||
        !p.every((v) => typeof v === 'number' && Number.isFinite(v))
      )
        fail('a landmark must be [x, y, z]');
    if (f.t < last) fail('frame times must not go backwards');
    last = f.t;
  }
  return t as Take;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

export function toLine(take: Take): string {
  const compact: Take = {
    ...take,
    frames: take.frames.map((f) => ({
      t: Math.round(f.t),
      lm: f.lm.map(([x, y, z]) => [round(x), round(y), round(z)] as [number, number, number]),
    })),
  };
  return JSON.stringify(compact);
}

export function toJsonl(takes: readonly Take[]): string {
  return takes.map(toLine).join('\n') + (takes.length ? '\n' : '');
}

export function fromJsonl(text: string): Take[] {
  const out: Take[] = [];
  const ids = new Set<string>();
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new TakeError(`line ${i + 1}: not valid JSON`);
    }
    try {
      const t = validateTake(raw);
      if (ids.has(t.id)) throw new TakeError('two takes share the same id');
      ids.add(t.id);
      out.push(t);
    } catch (e) {
      throw new TakeError(`line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return out;
}

export interface Coverage {
  label: string;
  takes: number;
  frames: number;
}

/** how much data exists per letter: counts only, no quality claim */
export function coverage(takes: readonly Take[]): Coverage[] {
  return LETTERS.map((label) => {
    const mine = takes.filter((t) => t.label === label);
    return { label, takes: mine.length, frames: mine.reduce((s, t) => s + t.frames.length, 0) };
  });
}

export interface Gap {
  label: string;
  takes: number;
  /** takes still missing to reach the target */
  missing: number;
}

/** letters below the target number of takes, in alphabet order (counts only) */
export function gaps(takes: readonly Take[], target: number): Gap[] {
  return coverage(takes)
    .map((c) => ({ label: c.label, takes: c.takes, missing: Math.max(0, target - c.takes) }))
    .filter((g) => g.missing > 0);
}
