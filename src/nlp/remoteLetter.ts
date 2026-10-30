import { ALPHABET_LABELS } from '../config/alphabet';
import type { LetterPush } from './protocol';

/** A letter recognised by another program (tools/dollarpy/classify_live.py), waiting for the person to add it. */
export interface RemoteLetter {
  letter: string;
  score: number;
  source: string;
  demo: boolean;
  /** when it arrived (ms): it is offered for a limited time and then forgotten */
  at: number;
}

/** how long a recognised letter is offered; a person may need a moment to find it on the screen */
export const REMOTE_LETTER_MS = 8000;

type Listener = (l: RemoteLetter | null) => void;
const listeners = new Set<Listener>();
let current: RemoteLetter | null = null;

/** called with every pushed letter; letters that are not in the active alphabet are dropped */
export function receiveLetter(p: LetterPush, now = Date.now()): void {
  if (!ALPHABET_LABELS.includes(p.letter)) return;
  setLetter({ letter: p.letter, score: p.score, source: p.source, demo: p.demo, at: now });
}

export function setLetter(l: RemoteLetter | null): void {
  current = l;
  for (const f of listeners) f(l);
}

export function subscribeLetter(f: Listener): () => void {
  listeners.add(f);
  f(current);
  return () => listeners.delete(f);
}
