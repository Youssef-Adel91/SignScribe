import { palmFraction, fullyInFrame } from '../vision/landmarks';
import { PALM_MAX, PALM_MIN } from '../vision/checks';
import type { HandFrame, HandObs } from '../vision/types';
import { defaultKind, type SigningHand, type Take, type TakeFrame, type TakeKind } from './dataset';

/** Choices that are fixed for a whole sitting. */
export interface Sitting {
  signer: string;
  session: string;
  hand: SigningHand;
  /** true when the frames come from the mock camera, so the take can never pass for real data */
  synthetic?: boolean;
}

export const RECORD = {
  countdownMs: 3000,
  /** static: frames are taken over this long */
  staticMs: 1500,
  /** at most this often (ms): neighbouring frames are nearly identical */
  staticEveryMs: 60,
  staticMinFrames: 12,
  /** dynamic: the movement is recorded for this long */
  dynamicMs: 2200,
  dynamicMinFrames: 20,
  /** frames where the hand is missing or badly placed may be at most this share of the take */
  maxBadShare: 0.25,
} as const;

export type RecorderState =
  | { kind: 'idle' }
  | { kind: 'countdown'; label: string; secondsLeft: number }
  | { kind: 'recording'; label: string; progress: number }
  | { kind: 'done'; take: Take }
  | { kind: 'failed'; reason: string };

/** Why a frame is not good enough to keep, or null when it is fine. */
export function frameProblem(hand: HandObs | undefined, frame: HandFrame): string | null {
  if (!hand) return 'no hand in view';
  if (hand.score < 0.5) return 'the hand is not clearly detected';
  if (!fullyInFrame(hand)) return 'part of the hand is outside the picture';
  const pf = palmFraction(hand, frame.width, frame.height);
  if (pf < PALM_MIN) return 'the hand is too far from the camera';
  if (pf > PALM_MAX) return 'the hand is too close to the camera';
  return null;
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * One take at a time: 3 s countdown (get the sign ready), then a short recording. Pure: it is fed
 * frames and the clock, so the rules are tested without a camera. It never keeps a take that is mostly
 * bad (no hand, hand cut off, too far, too close) and says why.
 */
export class TakeRecorder {
  state: RecorderState = { kind: 'idle' };
  private label = '';
  private kind: TakeKind = 'static';
  private sitting: Sitting = { signer: '', session: '', hand: 'right' };
  private t0 = 0;
  private recStart = 0;
  private lastKept = -Infinity;
  private kept: TakeFrame[] = [];
  private bad = 0;
  private seen = 0;
  private lastProblem: string | null = null;
  private size = { w: 0, h: 0 };
  private countdownMs: number = RECORD.countdownMs;

  start(
    label: string,
    sitting: Sitting,
    now: number,
    kind: TakeKind = defaultKind(label),
    countdownMs: number = RECORD.countdownMs,
  ): void {
    this.countdownMs = countdownMs;
    this.label = label;
    this.kind = kind;
    this.sitting = sitting;
    this.t0 = now;
    this.kept = [];
    this.bad = 0;
    this.seen = 0;
    this.lastProblem = null;
    this.lastKept = -Infinity;
    this.state = { kind: 'countdown', label, secondsLeft: Math.ceil(countdownMs / 1000) };
  }

  cancel(): void {
    this.state = { kind: 'idle' };
  }

  /** feed every camera frame (also the ones with no hand) */
  feed(frame: HandFrame): RecorderState {
    const now = frame.t;
    const s = this.state;
    if (s.kind === 'countdown') {
      const left = this.countdownMs - (now - this.t0);
      if (left > 0) {
        this.state = { kind: 'countdown', label: this.label, secondsLeft: Math.ceil(left / 1000) };
      } else {
        this.recStart = now;
        this.state = { kind: 'recording', label: this.label, progress: 0 };
      }
      return this.state;
    }
    if (s.kind !== 'recording') return s;

    const duration = this.kind === 'static' ? RECORD.staticMs : RECORD.dynamicMs;
    const hand = frame.hands.length
      ? frame.hands.reduce((a, b) => (b.score > a.score ? b : a))
      : undefined;
    const problem = frameProblem(hand, frame);
    this.seen++;
    this.size = { w: frame.width, h: frame.height };
    if (problem) {
      this.bad++;
      this.lastProblem = problem;
    }
    const due = this.kind === 'dynamic' || now - this.lastKept >= RECORD.staticEveryMs;
    if (hand && !problem && due) {
      this.kept.push({
        t: now - this.recStart,
        lm: hand.landmarks.map((l) => [l.x, l.y, l.z] as [number, number, number]),
      });
      this.lastKept = now;
    }
    const progress = Math.min(1, (now - this.recStart) / duration);
    if (progress < 1) {
      this.state = { kind: 'recording', label: this.label, progress };
      return this.state;
    }
    return (this.state = this.finish());
  }

  private finish(): RecorderState {
    const need = this.kind === 'static' ? RECORD.staticMinFrames : RECORD.dynamicMinFrames;
    const badShare = this.seen ? this.bad / this.seen : 1;
    if (this.kept.length < need || badShare > RECORD.maxBadShare) {
      const why = this.lastProblem ?? 'too few good frames';
      return { kind: 'failed', reason: `Not saved: ${why}. Try again.` };
    }
    const take: Take = {
      v: 1,
      id: newId(),
      label: this.label,
      kind: this.kind,
      signer: this.sitting.signer,
      session: this.sitting.session,
      hand: this.sitting.hand,
      width: this.size.w,
      height: this.size.h,
      createdAt: new Date().toISOString(),
      ...(this.sitting.synthetic ? { synthetic: true } : {}),
      frames: this.kept,
    };
    return { kind: 'done', take };
  }
}
