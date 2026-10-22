import type { Candidate, Ev, Hand } from '../state/machine';
import { palmSize } from '../vision/landmarks';
import { inCommandZone } from '../vision/zones';
import type { HandFrame, HandObs } from '../vision/types';
import type { MotionRecognizer, StaticRecognizer } from './types';

/**
 * All of these are heuristics chosen before any real data exists. Tune them from a real camera and a
 * measured model; every one is exported so a test can reproduce a reported problem.
 */
export const LETTER = {
  /** a guess below this vote share is ignored */
  minConfidence: 0.6,
  /** the same best letter must be seen this long before a candidate is shown */
  stableMs: 250,
  /** and held this long, with confidence at least `confirmConfidence`, to be written */
  holdMs: 800,
  confirmConfidence: 0.75,
  /** after a letter is written the hand must change (other letter / no letter) this long before the next one */
  releaseMs: 300,
  /** how often the shown guess is refreshed (ms) */
  refreshMs: 150,
  /** a motion starts when the tracked fingertip moves faster than this (palm lengths per second) */
  motionStartSpeed: 1.2,
  /** ...and ends after it has been slower than this for `motionEndMs` */
  motionStopSpeed: 0.5,
  motionEndMs: 250,
  /** shortest and longest motion that is tried */
  motionMinMs: 300,
  motionMaxMs: 2000,
  /** shortest path, in palm lengths, that counts as a drawn shape rather than a tremor */
  motionMinLength: 0.8,
  /** $P score needed to write the letter (the movement itself is the "hold") */
  motionMinScore: 0.6,
} as const;

export interface LetterInput {
  /** screen number from the state machine */
  screen: number;
  signingHand: Hand;
}

export interface LetterUI {
  /** best guess right now (may still be too weak to show) */
  guess: { letter: string; confidence: number } | null;
  /** 0..1 progress of the hold that writes the letter */
  progress: number;
  /** a moving sign is being followed */
  tracingMotion: boolean;
}

/**
 * Turns hand frames on the spelling screens (6, 7) into LETTER_CANDIDATE / LETTER_CONFIRMED /
 * CANDIDATE_LOST. Pure, so it is tested with fake recognizers. The hand that signs is the one OUTSIDE
 * the command zone; the zone hand makes commands (space, delete, ...) and is never read as a letter.
 */
export class LetterController {
  private cand: string | null = null;
  private candSince = 0;
  private shown = false;
  private confirmedLetter: string | null = null;
  private releaseSince: number | null = null;
  private lastScreen = -1;
  // motion
  private trail: { t: number; x: number; y: number; s: number }[] = [];
  private moving = false;
  private slowSince: number | null = null;
  private motionStart = 0;
  private motionCooldownUntil = 0;
  private lastSentT = -Infinity;
  private lastSentLetter: string | null = null;

  constructor(
    private readonly stat: StaticRecognizer | null,
    private readonly motion: MotionRecognizer | null = null,
  ) {}

  /**
   * A command (space, delete, cancel) was just given while a letter was held: the held sign must be
   * released before it can be written, otherwise the same sign would come straight back.
   */
  notifyCommand(): void {
    this.confirmedLetter = this.cand ?? this.confirmedLetter;
    this.shown = false;
    this.releaseSince = null;
  }

  private reset(): void {
    this.cand = null;
    this.shown = false;
    this.confirmedLetter = null;
    this.releaseSince = null;
    this.trail = [];
    this.moving = false;
    this.slowSince = null;
  }

  private signingHandOf(frame: HandFrame, signing: Hand): HandObs | null {
    const outside = frame.hands.filter((h) => !inCommandZone(h, signing));
    if (outside.length === 0) return null;
    // the highest-scoring one when two hands are outside the zone
    return outside.reduce((a, b) => (b.score > a.score ? b : a));
  }

  step(frame: HandFrame, inp: LetterInput): { events: Ev[]; ui: LetterUI } {
    const { t } = frame;
    const events: Ev[] = [];
    const idle: LetterUI = { guess: null, progress: 0, tracingMotion: false };
    if (inp.screen !== this.lastScreen) {
      this.lastScreen = inp.screen;
      this.reset();
    }
    if (inp.screen !== 6 && inp.screen !== 7) return { events, ui: idle };

    const hand = this.signingHandOf(frame, inp.signingHand);
    if (!hand || hand.score < 0.5) {
      if (this.shown) events.push({ type: 'CANDIDATE_LOST' });
      this.cand = null;
      this.shown = false;
      this.trail = [];
      this.moving = false;
      this.slowSince = null;
      this.noteRelease(null, t);
      return { events, ui: idle };
    }

    // ---- moving signs (J, Z): follow one fingertip, recognise when the movement stops
    let tracing = false;
    if (this.motion && t >= this.motionCooldownUntil) {
      const r = this.followMotion(hand, frame, t);
      if (r.event) {
        events.push(...r.event);
        this.reset();
        this.motionCooldownUntil = t + 800;
        return { events, ui: idle };
      }
      tracing = r.tracing;
    }
    if (tracing) {
      // while a motion is being drawn the static guess is meaningless (the hand is mid-air)
      if (this.shown) events.push({ type: 'CANDIDATE_LOST' });
      this.cand = null;
      this.shown = false;
      return { events, ui: { guess: null, progress: 0, tracingMotion: true } };
    }

    // ---- static letters
    const g =
      this.stat?.recognize(hand, frame.width, frame.height, inp.signingHand === 'left') ?? null;
    const strong = g && g.confidence >= LETTER.minConfidence ? g : null;
    this.noteRelease(strong ? strong.letter : null, t);

    if (!strong) {
      if (this.shown) events.push({ type: 'CANDIDATE_LOST' });
      this.cand = null;
      this.shown = false;
      return {
        events,
        ui: {
          guess: g ? { letter: g.letter, confidence: g.confidence } : null,
          progress: 0,
          tracingMotion: false,
        },
      };
    }
    if (strong.letter !== this.cand) {
      if (this.shown) events.push({ type: 'CANDIDATE_LOST' });
      this.cand = strong.letter;
      this.candSince = t;
      this.shown = false;
    }
    // a letter that was just written must be released before it can be written again
    if (this.confirmedLetter !== null) {
      return {
        events,
        ui: {
          guess: { letter: strong.letter, confidence: strong.confidence },
          progress: 0,
          tracingMotion: false,
        },
      };
    }
    const stable = t - this.candSince;
    if (stable >= LETTER.stableMs) {
      // the guess is refreshed a few times a second, not on every camera frame
      if (
        !this.shown ||
        strong.letter !== this.lastSentLetter ||
        t - this.lastSentT >= LETTER.refreshMs
      ) {
        const candidate: Candidate = {
          letter: strong.letter,
          confidence: strong.confidence,
          alternatives: strong.alternatives,
        };
        events.push({ type: 'LETTER_CANDIDATE', candidate });
        this.lastSentT = t;
        this.lastSentLetter = strong.letter;
      }
      this.shown = true;
    }
    const progress = this.shown
      ? Math.min(1, (stable - LETTER.stableMs) / (LETTER.holdMs - LETTER.stableMs))
      : 0;
    if (this.shown && stable >= LETTER.holdMs && strong.confidence >= LETTER.confirmConfidence) {
      events.push({ type: 'LETTER_CONFIRMED', letter: strong.letter });
      this.confirmedLetter = strong.letter;
      this.shown = false;
      this.releaseSince = null;
      return {
        events,
        ui: {
          guess: { letter: strong.letter, confidence: strong.confidence },
          progress: 1,
          tracingMotion: false,
        },
      };
    }
    return {
      events,
      ui: {
        guess: { letter: strong.letter, confidence: strong.confidence },
        progress,
        tracingMotion: false,
      },
    };
  }

  /** the hand must show something else (or nothing) for releaseMs before the written letter can repeat */
  private noteRelease(letter: string | null, t: number): void {
    if (this.confirmedLetter === null) return;
    if (letter === this.confirmedLetter) {
      this.releaseSince = null;
      return;
    }
    if (this.releaseSince === null) this.releaseSince = t;
    if (t - this.releaseSince >= LETTER.releaseMs) {
      this.confirmedLetter = null;
      this.releaseSince = null;
      this.cand = null;
    }
  }

  private followMotion(
    hand: HandObs,
    frame: HandFrame,
    t: number,
  ): { tracing: boolean; event: Ev[] | null } {
    const m = this.motion!;
    const p = hand.landmarks[m.landmark];
    const ps = palmSize(hand, frame.width, frame.height) || 1;
    const x = p.x * frame.width;
    const y = p.y * frame.height;
    const prev = this.trail[this.trail.length - 1];
    let speed = 0;
    if (prev && t > prev.t) speed = Math.hypot(x - prev.x, y - prev.y) / ps / ((t - prev.t) / 1000);
    this.trail.push({ t, x, y, s: speed });
    while (this.trail.length > 0 && t - this.trail[0].t > LETTER.motionMaxMs + 500)
      this.trail.shift();

    if (!this.moving) {
      if (speed >= LETTER.motionStartSpeed) {
        this.moving = true;
        this.slowSince = null;
        this.motionStart = prev ? prev.t : t;
      }
      return { tracing: false, event: null };
    }
    if (speed < LETTER.motionStopSpeed) {
      if (this.slowSince === null) this.slowSince = t;
    } else {
      this.slowSince = null;
    }
    const ended = this.slowSince !== null && t - this.slowSince >= LETTER.motionEndMs;
    const tooLong = t - this.motionStart > LETTER.motionMaxMs;
    if (!ended && !tooLong) return { tracing: true, event: null };

    // the movement is over: judge the path from its start to the moment it slowed down
    const endT = this.slowSince ?? t;
    const path = this.trail
      .filter((q) => q.t >= this.motionStart && q.t <= endT)
      .map((q) => ({ x: q.x, y: q.y }));
    this.moving = false;
    this.slowSince = null;
    const dur = endT - this.motionStart;
    let length = 0;
    for (let i = 1; i < path.length; i++)
      length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    if (dur < LETTER.motionMinMs || length / ps < LETTER.motionMinLength)
      return { tracing: false, event: null };
    const g = m.recognize(path);
    if (!g || g.score < LETTER.motionMinScore) return { tracing: false, event: null };
    return {
      tracing: false,
      event: [
        {
          type: 'LETTER_CANDIDATE',
          candidate: { letter: g.letter, confidence: g.score, alternatives: [] },
        },
        { type: 'LETTER_CONFIRMED', letter: g.letter },
      ],
    };
  }
}
