/**
 * The short sound and vibration that answer a WRITTEN letter. Exactly one of each per written letter: it is called from the
 * LETTER_CONFIRMED event (never from a frame), and a minimum gap protects against a burst of events anyway. The person can switch
 * both off (screen 14: "Sounds only" keeps them, "Silent" removes them with the speech). Everything is optional: no audio, no
 * vibration motor or a blocked API means silence, never an error.
 */
export interface FeedbackOutput {
  tone(): void;
  buzz(): void;
}

class BrowserOutput implements FeedbackOutput {
  private ctx: AudioContext | null = null;
  tone(): void {
    try {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      this.ctx ??= new Ctor();
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.06);
    } catch {
      /* no audio: silence */
    }
  }
  buzz(): void {
    try {
      navigator.vibrate?.(25);
    } catch {
      /* no vibration */
    }
  }
}

export class Feedback {
  private last = -Infinity;
  constructor(
    private readonly out: FeedbackOutput,
    private readonly minGapMs = 400,
    private readonly now: () => number = () => performance.now(),
    private readonly enabled: () => boolean = () => true,
  ) {}

  /** one written letter. Returns whether anything was played. */
  letterWritten(): boolean {
    if (!this.enabled()) return false;
    const t = this.now();
    if (t - this.last < this.minGapMs) return false;
    this.last = t;
    this.out.tone();
    this.out.buzz();
    return true;
  }
}

let on = true;
export const setFeedbackEnabled = (v: boolean): void => {
  on = v;
};
export const isFeedbackEnabled = (): boolean => on;

export const feedback = new Feedback(
  new BrowserOutput(),
  400,
  () => performance.now(),
  isFeedbackEnabled,
);
