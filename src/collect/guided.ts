import { defaultKind, type TakeKind } from './dataset';

/** Timing of a guided run. The first take of a letter needs time to get the sign ready; the next ones do not. */
export const GUIDED = {
  firstCountdownMs: 3000,
  nextCountdownMs: 1500,
  /** pause after a saved take, so the researcher sees "Saved" and the count go up */
  restMs: 700,
  /** pause after a refused take, so the reason can be read */
  failRestMs: 1800,
  /** after this many refused takes in a row the run stops and asks for help */
  maxFailsInRow: 3,
} as const;

export interface GuidedStep {
  label: string;
  kind: TakeKind;
  /** 1-based take number for this letter in this run */
  takeNo: number;
  /** how many takes this letter gets in this run */
  ofTotal: number;
  countdownMs: number;
  /** the letter before this one, when this is its first take (the signer changes sign) */
  newLetter: boolean;
}

/**
 * The order of a guided recording run: for each letter that has fewer takes than the target, in alphabet
 * order, the missing takes one after the other. Pure, so the sequence is tested without a camera. The panel
 * asks `current()`, records, then reports `saved()` or `failed()`; nothing needs clicking in between.
 */
export class GuidedRun {
  private queue: GuidedStep[] = [];
  private i = 0;
  private fails = 0;
  readonly total: number;

  constructor(
    labels: readonly string[],
    counts: Readonly<Record<string, number>>,
    readonly target: number,
  ) {
    for (const label of labels) {
      const missing = Math.max(0, target - (counts[label] ?? 0));
      for (let n = 1; n <= missing; n++)
        this.queue.push({
          label,
          kind: defaultKind(label),
          takeNo: n,
          ofTotal: missing,
          newLetter: n === 1,
          countdownMs: n === 1 ? GUIDED.firstCountdownMs : GUIDED.nextCountdownMs,
        });
    }
    this.total = this.queue.length;
  }

  /** what to record now, or null when every letter has reached the target */
  current(): GuidedStep | null {
    return this.queue[this.i] ?? null;
  }

  get done(): number {
    return this.i;
  }

  saved(): void {
    this.fails = 0;
    this.i = Math.min(this.i + 1, this.queue.length);
  }

  /** the take was refused (bad frames). Returns 'retry' for the same step, or 'stop' after too many in a row */
  failed(): 'retry' | 'stop' {
    this.fails++;
    return this.fails >= GUIDED.maxFailsInRow ? 'stop' : 'retry';
  }

  /** leave the current letter's remaining takes and go to the next letter */
  skipLetter(): void {
    const cur = this.queue[this.i];
    if (!cur) return;
    while (this.queue[this.i]?.label === cur.label) this.i++;
    this.fails = 0;
  }
}
