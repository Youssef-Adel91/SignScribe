import { FINGERS, fingerExtension, smooth, thumbExtension, thumbVertical } from './landmarks';
import type { GestureLabel, GestureResult, HandObs } from './types';

/** below this the pose is not trusted and the label is 'none' */
export const ACCEPT = 0.55;
/** the best label must beat the second best by this much */
export const MARGIN = 0.15;

const min = (...v: number[]) => Math.min(...v);

/**
 * Rule-based classifier for one hand in one frame. Every score is 0..1 and built from the same
 * few geometric features (finger extension, thumb extension, thumb direction), so a pose that is
 * between two gestures gets a low score for both and ends up as 'none' instead of a wrong guess.
 */
export function classify(hand: HandObs, w: number, h: number): GestureResult {
  const ext = FINGERS.map((f) => fingerExtension(hand, f, w, h)); // index, middle, ring, pinky
  const curl = ext.map((e) => 1 - e);
  const thumb = thumbExtension(hand, w, h);
  const v = thumbVertical(hand, w, h);
  const upness = smooth(v, 0.45, 0.8);
  const downness = smooth(-v, 0.45, 0.8);
  const vertical = thumb * Math.max(upness, downness);

  const scores = {
    open: min(...ext),
    fist: min(...curl) * (1 - vertical),
    up: min(...curl) * thumb * upness,
    down: min(...curl) * thumb * downness,
    point: min(ext[0], curl[1], curl[2], curl[3]),
  };

  const ranked = (Object.entries(scores) as [keyof typeof scores, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const [best, second] = ranked;
  const ok = best[1] >= ACCEPT && best[1] - second[1] >= MARGIN;
  return { label: ok ? best[0] : 'none', confidence: best[1], scores };
}

export interface Stable {
  label: GestureLabel;
  /** when the stable label began (ms) */
  since: number;
}

/**
 * Debounce with hysteresis: a new label has to be the raw answer for `enterMs` before it becomes
 * the stable one, and a gesture is only dropped (back to 'none') after `exitMs` of not seeing it.
 * A one-frame glitch therefore never changes the stable label.
 */
export class GestureStabilizer {
  private cur: Stable = { label: 'none', since: 0 };
  private pending: GestureLabel | null = null;
  private pendingSince = 0;

  constructor(
    private readonly enterMs = 100,
    private readonly exitMs = 200,
  ) {}

  update(raw: GestureLabel, t: number): Stable {
    if (raw === this.cur.label) {
      this.pending = null;
      return this.cur;
    }
    if (raw !== this.pending) {
      this.pending = raw;
      this.pendingSince = t;
    }
    const need = raw === 'none' ? this.exitMs : this.enterMs;
    if (t - this.pendingSince >= need) {
      this.cur = { label: raw, since: t };
      this.pending = null;
    }
    return this.cur;
  }

  get value(): Stable {
    return this.cur;
  }

  reset(): void {
    this.cur = { label: 'none', since: 0 };
    this.pending = null;
  }
}
