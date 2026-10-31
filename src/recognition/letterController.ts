import type { Candidate, Ev, Hand } from '../state/machine';
import { palmSize } from '../vision/landmarks';
import { inCommandZone } from '../vision/zones';
import type { HandFrame, HandObs } from '../vision/types';
import type { MotionRecognizer, StaticRecognizer } from './types';
import { isRejected, resolveTuning, type LetterTuning } from './tuning';

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

export interface CommandState {
  /**
   * A control gesture is being recognised or held (delete, space, finish, ...), or the pointer / the command hand is in the
   * command zone. Letters are neither shown nor written while this is true, and for `commandHoldoffMs` after it.
   */
  active: boolean;
  /** a control event was sent on this very frame */
  fired: boolean;
}

export interface LetterInput {
  /** screen number from the state machine */
  screen: number;
  signingHand: Hand;
  /** what the gesture controller sees this frame; absent = no command in progress */
  command?: CommandState;
}

/** why no letter is on its way right now (or that one is): for the debug overlay and its log, never for the signer */
export type LetterState =
  | 'off-screen'
  | 'no-hand'
  | 'command'
  | 'moving'
  | 'settling'
  | 'tracing-motion'
  | 'rejected'
  | 'cooldown'
  | 'wait-release'
  | 'candidate'
  | 'holding'
  | 'committed';

export interface LetterDebug {
  state: LetterState;
  /** smoothed hand speed in palm lengths per second (all 21 landmarks) */
  speed: number;
  /** consecutive still frames so far, and how many are needed */
  stillCount: number;
  stillFrames: number;
  /** ms the same letter has been the strong guess */
  stableMs: number;
  /** ms left of the cooldown / the command hold-off (0 = none) */
  cooldownLeftMs: number;
  commandLeftMs: number;
  /** why the guess was thrown away: low confidence, small margin, the "none" class; '' when it was kept */
  rejectedBecause: string;
}

export interface LetterUI {
  /**
   * best guess right now, ONLY when it is strong enough to act on (confidence >= minConfidence, margin, not "none", hand still).
   * A weaker guess is null here: the app shows nothing rather than a guess that is probably wrong.
   */
  guess: { letter: string; confidence: number } | null;
  /**
   * What the recognizer said, strong or not: the three best letters with their confidence. For the developer
   * panel only (?letterdebug=1); no screen may show it to the signer. Empty while the hand moves (it is not classified then).
   */
  raw: { letter: string; confidence: number }[];
  /** 0..1 progress of the hold that writes the letter */
  progress: number;
  /** a moving sign is being followed */
  tracingMotion: boolean;
  debug: LetterDebug;
}

/** mean distance the 21 landmarks moved since the last frame, in palm lengths, as a speed per second */
export function handSpeed(
  prev: { x: number; y: number }[],
  cur: { x: number; y: number }[],
  width: number,
  height: number,
  palm: number,
  dtMs: number,
): number {
  if (prev.length !== cur.length || cur.length === 0 || !(palm > 0) || !(dtMs > 0)) return 0;
  let sum = 0;
  for (let i = 0; i < cur.length; i++)
    sum += Math.hypot((cur[i].x - prev[i].x) * width, (cur[i].y - prev[i].y) * height);
  return sum / cur.length / palm / (dtMs / 1000);
}

/**
 * Turns hand frames on the spelling screens (6, 7) into LETTER_CANDIDATE / LETTER_CONFIRMED /
 * CANDIDATE_LOST. Pure, so it is tested with fake recognizers. The hand that signs is the one OUTSIDE
 * the command zone; the zone hand makes commands (space, delete, ...) and is never read as a letter.
 *
 * A letter is only classified when the hand is STILL (speed under tuning.maxSpeed for tuning.stillFrames frames in a row, with
 * hysteresis), shown after tuning.stableMs of the same strong guess and written after tuning.holdMs. After a written letter the
 * hand must change, move or leave for tuning.releaseMs, and nothing is written for tuning.cooldownMs. While a control gesture
 * or the command zone is active, and for tuning.commandHoldoffMs after, no letter is shown or written at all.
 * The closed set of letters would call any pose a letter; "none" (see REJECT_LABEL) and the confidence / margin limits are the way out.
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
  // gating
  private prevLm: { x: number; y: number }[] | null = null;
  private prevT = 0;
  private speed = 0;
  private handMoving = false;
  private stillCount = 0;
  private cooldownUntil = 0;
  private commandUntil = 0;
  private tuning: LetterTuning;

  constructor(
    private readonly stat: StaticRecognizer | null,
    private readonly motion: MotionRecognizer | null = null,
    tuning?: LetterTuning,
  ) {
    this.tuning = tuning ?? resolveTuning('asl', stat?.id, {});
  }

  /** new values (from the overlay or after another model loaded); they apply from the next frame */
  setTuning(t: LetterTuning): void {
    this.tuning = t;
  }
  getTuning(): LetterTuning {
    return this.tuning;
  }

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
    this.prevLm = null;
    this.speed = 0;
    this.handMoving = false;
    this.stillCount = 0;
  }

  private signingHandOf(frame: HandFrame, signing: Hand): HandObs | null {
    const outside = frame.hands.filter((h) => !inCommandZone(h, signing));
    if (outside.length === 0) return null;
    // the highest-scoring one when two hands are outside the zone
    return outside.reduce((a, b) => (b.score > a.score ? b : a));
  }

  private dbg(state: LetterState, t: number, over: Partial<LetterDebug> = {}): LetterDebug {
    return {
      state,
      speed: this.speed,
      stillCount: this.stillCount,
      stillFrames: this.tuning.stillFrames,
      stableMs: this.cand !== null ? t - this.candSince : 0,
      cooldownLeftMs: Math.max(0, this.cooldownUntil - t),
      commandLeftMs: Math.max(0, this.commandUntil - t),
      rejectedBecause: '',
      ...over,
    };
  }

  private ui(
    state: LetterState,
    t: number,
    p: Partial<Pick<LetterUI, 'guess' | 'raw' | 'progress' | 'tracingMotion'>> = {},
    d: Partial<LetterDebug> = {},
  ): LetterUI {
    return {
      guess: null,
      raw: [],
      progress: 0,
      tracingMotion: false,
      ...p,
      debug: this.dbg(state, t, d),
    };
  }

  /** nothing may be shown: drop the candidate (and tell the machine if one was on screen) */
  private dropCandidate(events: Ev[]): void {
    if (this.shown) events.push({ type: 'CANDIDATE_LOST' });
    this.cand = null;
    this.shown = false;
  }

  step(frame: HandFrame, inp: LetterInput): { events: Ev[]; ui: LetterUI } {
    const { t } = frame;
    const T = this.tuning;
    const events: Ev[] = [];
    if (inp.screen !== this.lastScreen) {
      this.lastScreen = inp.screen;
      this.reset();
      this.cooldownUntil = 0;
      this.commandUntil = 0;
    }
    if (inp.screen !== 6 && inp.screen !== 7) return { events, ui: this.ui('off-screen', t) };

    // ---- a control gesture or the command zone has priority over every letter, on this very frame
    if (inp.command && (inp.command.active || inp.command.fired)) {
      if (t >= this.commandUntil) this.notifyCommand(); // the sign held now must be released before it can be written
      this.commandUntil = Math.max(this.commandUntil, t + T.commandHoldoffMs);
    }
    const commandOn = t < this.commandUntil;

    const hand = this.signingHandOf(frame, inp.signingHand);
    if (!hand || hand.score < 0.5) {
      this.dropCandidate(events);
      this.trail = [];
      this.moving = false;
      this.slowSince = null;
      this.prevLm = null;
      this.speed = 0;
      this.stillCount = 0;
      this.handMoving = false;
      this.noteRelease(null, t);
      return { events, ui: this.ui(commandOn ? 'command' : 'no-hand', t) };
    }

    // ---- how fast the hand moves (every landmark, so fingers changing shape count too), with hysteresis
    const palm = palmSize(hand, frame.width, frame.height) || 1;
    if (this.prevLm && t > this.prevT) {
      const raw = handSpeed(
        this.prevLm,
        hand.landmarks,
        frame.width,
        frame.height,
        palm,
        t - this.prevT,
      );
      this.speed = 0.5 * raw + 0.5 * this.speed;
    } else {
      this.speed = 0;
    }
    this.prevLm = hand.landmarks.map((p) => ({ x: p.x, y: p.y }));
    this.prevT = t;
    if (!this.handMoving && this.speed > T.maxSpeed) this.handMoving = true;
    else if (this.handMoving && this.speed < T.maxSpeed * 0.7) this.handMoving = false;
    this.stillCount = this.handMoving ? 0 : this.stillCount + 1;

    if (commandOn) {
      this.dropCandidate(events);
      return { events, ui: this.ui('command', t) };
    }

    // ---- moving signs (J, Z): follow one fingertip, recognise when the movement stops
    let tracing = false;
    if (this.motion && t >= this.motionCooldownUntil) {
      const r = this.followMotion(hand, frame, t);
      if (r.event) {
        events.push(...r.event);
        this.reset();
        this.motionCooldownUntil = t + 800;
        return { events, ui: this.ui('off-screen', t) };
      }
      tracing = r.tracing;
    }
    if (tracing) {
      // while a motion is being drawn the static guess is meaningless (the hand is mid-air)
      this.dropCandidate(events);
      return { events, ui: this.ui('tracing-motion', t, { tracingMotion: true }) };
    }

    // ---- not classified while the hand moves or has not been still long enough
    if (this.handMoving || this.stillCount < T.stillFrames) {
      this.dropCandidate(events);
      this.noteRelease(null, t);
      return { events, ui: this.ui(this.handMoving ? 'moving' : 'settling', t) };
    }

    // ---- static letters
    const g =
      this.stat?.recognize(hand, frame.width, frame.height, inp.signingHand === 'left') ?? null;
    const raw = g
      ? [
          { letter: g.letter, confidence: g.confidence },
          ...g.alternatives
            .slice(0, 2)
            .map((a) => ({ letter: a.letter, confidence: a.confidence })),
        ]
      : [];
    let why = '';
    if (g) {
      if (isRejected(g.letter)) why = 'none';
      else if (g.confidence < T.minConfidence) why = 'low-confidence';
      else if (T.minMargin > 0 && g.confidence - (g.alternatives[0]?.confidence ?? 0) < T.minMargin)
        why = 'small-margin';
    }
    const strong = g && !why ? g : null;
    this.noteRelease(strong ? strong.letter : null, t);

    if (!strong) {
      this.dropCandidate(events);
      return { events, ui: this.ui('rejected', t, { raw }, { rejectedBecause: why }) };
    }
    if (strong.letter !== this.cand) {
      if (this.shown) events.push({ type: 'CANDIDATE_LOST' });
      this.cand = strong.letter;
      this.candSince = t;
      this.shown = false;
    }
    const guess = { letter: strong.letter, confidence: strong.confidence };
    // a letter that was just written must be released (and the cooldown must pass) before it can be written again
    if (this.confirmedLetter !== null) {
      return { events, ui: this.ui('wait-release', t, { guess, raw }) };
    }
    if (t < this.cooldownUntil) {
      // nothing is tracked during the cooldown: the hold of the next letter starts when it ends
      this.dropCandidate(events);
      return { events, ui: this.ui('cooldown', t, { guess, raw }) };
    }
    const stable = t - this.candSince;
    if (stable >= T.stableMs) {
      // the guess is refreshed a few times a second, not on every camera frame
      if (
        !this.shown ||
        strong.letter !== this.lastSentLetter ||
        t - this.lastSentT >= T.refreshMs
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
    const progress = this.shown ? Math.min(1, (stable - T.stableMs) / (T.holdMs - T.stableMs)) : 0;
    if (this.shown && stable >= T.holdMs && strong.confidence >= T.confirmConfidence) {
      events.push({ type: 'LETTER_CONFIRMED', letter: strong.letter });
      this.confirmedLetter = strong.letter;
      this.shown = false;
      this.releaseSince = null;
      this.cooldownUntil = t + T.cooldownMs;
      return { events, ui: this.ui('committed', t, { guess, raw, progress: 1 }) };
    }
    return {
      events,
      ui: this.ui(this.shown ? 'holding' : 'candidate', t, { guess, raw, progress }),
    };
  }

  /**
   * After a letter was written the hand must leave, change or move before the same sign can be written again:
   * a different sign (or none) for releaseMs, or the hand moving for releaseMs, or no hand.
   */
  private noteRelease(letter: string | null, t: number): void {
    if (this.confirmedLetter === null) return;
    const away = letter !== this.confirmedLetter || this.handMoving;
    if (!away) {
      this.releaseSince = null;
      return;
    }
    if (this.releaseSince === null) this.releaseSince = t;
    if (t - this.releaseSince >= this.tuning.releaseMs) {
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
