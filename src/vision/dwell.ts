import type { Ev } from '../state/machine';
import type { Pt, Rect } from './types';

export interface Target {
  id: string;
  rect: Rect;
  event: Ev;
}

/** targets are never smaller than this to hit (CSS px): the Fitts's-law floor from PLAN.md */
export const MIN_HIT = 96;
/** the pointer may drift this far outside a target before the hold is lost */
const LEAVE_MARGIN = 16;
/** ...and may be absent (hand flickers) this long without losing the hold */
const GRACE_MS = 250;

/** Dwell time that adapts to the person: slower after near-misses, quicker after steady successes. */
export class AdaptiveDwell {
  ms: number;
  private streak = 0;
  constructor(
    start = 800,
    readonly min = 600,
    readonly max = 1400,
  ) {
    this.ms = start;
  }
  success(): void {
    this.streak++;
    if (this.streak >= 3) {
      this.ms = Math.max(this.min, this.ms - 50);
      this.streak = 0;
    }
  }
  /** pointer left a target after holding most of the way: the person wanted it but drifted */
  nearMiss(): void {
    this.streak = 0;
    this.ms = Math.min(this.max, this.ms + 100);
  }
}

function inflate(r: Rect, minSize: number, extra = 0): Rect {
  const w = Math.max(r.w, minSize) + extra * 2;
  const h = Math.max(r.h, minSize) + extra * 2;
  return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
}
const contains = (r: Rect, p: Pt) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const centerDist = (r: Rect, p: Pt) => Math.hypot(r.x + r.w / 2 - p.x, r.y + r.h / 2 - p.y);

export interface DwellState {
  targetId: string | null;
  /** 0..1 */
  progress: number;
  fired: Target | null;
}

/**
 * Point-and-hold selection. Feed it the pointer (or null) and the current targets every frame; it
 * fires a target once the pointer has stayed on it for `dwell.ms`. After firing, the same target
 * will not fire again until the pointer has left it.
 */
export class DwellEngine {
  readonly adaptive: AdaptiveDwell;
  private cur: string | null = null;
  private acc = 0;
  private lastT: number | null = null;
  private lostSince: number | null = null;
  private lockLostSince: number | null = null;
  private locked: string | null = null;

  constructor(adaptive = new AdaptiveDwell()) {
    this.adaptive = adaptive;
  }

  update(p: Pt | null, targets: Target[], t: number): DwellState {
    const dt = this.lastT === null ? 0 : Math.max(0, t - this.lastT);
    this.lastT = t;

    // which target is the pointer on? the nearest centre among those that contain it
    let hit: Target | null = null;
    if (p) {
      let best = Infinity;
      for (const tg of targets) {
        const reach = tg.id === this.cur ? LEAVE_MARGIN : 0;
        if (contains(inflate(tg.rect, MIN_HIT, reach), p)) {
          const d = centerDist(tg.rect, p);
          if (d < best) {
            best = d;
            hit = tg;
          }
        }
      }
    }

    // a locked target is released once the pointer has really left it
    if (this.locked && (!hit || hit.id !== this.locked)) {
      if (this.lockLostSince === null) this.lockLostSince = t;
      if (t - this.lockLostSince > GRACE_MS) {
        this.locked = null;
        this.lockLostSince = null;
      }
    } else {
      this.lockLostSince = null;
    }

    if (hit && hit.id === this.locked) {
      return { targetId: null, progress: 0, fired: null };
    }

    if (hit) {
      if (hit.id !== this.cur) {
        this.endHold();
        this.cur = hit.id;
        this.acc = 0;
      }
      this.lostSince = null;
      this.acc += dt;
      const progress = Math.min(1, this.acc / this.adaptive.ms);
      if (progress >= 1) {
        this.adaptive.success();
        this.locked = hit.id;
        this.cur = null;
        this.acc = 0;
        return { targetId: hit.id, progress: 1, fired: hit };
      }
      return { targetId: hit.id, progress, fired: null };
    }

    // no target under the pointer: hold the progress for a moment, then give up
    if (this.cur) {
      if (this.lostSince === null) this.lostSince = t;
      if (t - this.lostSince > GRACE_MS) {
        this.endHold();
        this.cur = null;
        this.acc = 0;
        this.lostSince = null;
        return { targetId: null, progress: 0, fired: null };
      }
      return { targetId: this.cur, progress: Math.min(1, this.acc / this.adaptive.ms), fired: null };
    }
    return { targetId: null, progress: 0, fired: null };
  }

  private endHold(): void {
    if (this.cur && this.acc / this.adaptive.ms >= 0.5) this.adaptive.nearMiss();
  }

  reset(): void {
    this.cur = null;
    this.acc = 0;
    this.lostSince = null;
    this.lockLostSince = null;
    this.lastT = null;
  }
}
