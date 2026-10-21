import type { DwellSetting, Ev, Hand } from '../state/machine';
import type { Checks } from './checks';
import { DwellEngine, type Target } from './dwell';
import { GestureStabilizer, classify, type Stable } from './gestures';
import { LM, mirror, palmCenter } from './landmarks';
import { PointerFilter, cameraToScreen } from './pointer';
import type { GestureLabel, HandFrame, HandObs, Pt } from './types';
import { inCommandZone, sideOf, type Side } from './zones';

/** How long each gesture must be held (ms), on top of the debounce in GestureStabilizer. */
export const HOLD = {
  wake: 2000,
  help: 1000,
  open: 500,
  fist: 500,
  up: 600,
  down: 600,
} as const;
/** no hand for this long: spelling is paused (screen 08) */
export const HAND_LOST_MS = 1000;
/** a hand must be back for this long before spelling resumes */
export const HAND_BACK_MS = 300;
/** all three setup checks must stay green this long */
export const CHECKS_HOLD_MS = 1500;
/** the pointer may vanish this long (flicker) without losing the dwell */
const POINTER_GRACE_MS = 250;
/** the signing hand makes letters, so the command gestures only count in the command zone there */
const ZONE_ONLY_SCREENS = new Set([6, 7, 10]);

export interface ControllerInput {
  /** screen number from the state machine (1..13; 8 = hand lost, 13 = help) */
  screen: number;
  signingHand: Hand;
  /** the machine is in a state that needs a hand (spell, word suggestion, picture cards) */
  needsHand: boolean;
  viewport: { w: number; h: number };
  checks: Checks | null;
  /** hold-time setting from screen 14; absent = automatic */
  dwell?: DwellSetting;
}

export interface HandView {
  side: Side;
  gesture: GestureLabel;
  confidence: number;
  inZone: boolean;
}

export interface VisionUI {
  hands: number;
  handViews: HandView[];
  /** viewport px, filtered, or null when nobody is pointing */
  pointer: Pt | null;
  dwell: { id: string | null; progress: number; ms: number };
  wake: number;
  help: number;
  command: { label: GestureLabel | null; progress: number };
  handLost: boolean;
}

interface TrackedHand {
  obs: HandObs;
  g: Stable;
  conf: number;
  inZone: boolean;
  side: Side;
}

/** a screen of the main flow (not the hand-lost overlay 8); 14 = comfort settings, between 03 and 04 */
const isFlowScreen = (screen: number, from: number) =>
  (screen >= from && screen <= 11 && screen !== 8) || screen === 14;

/** What each command gesture does on each screen. null = nothing. */
export function commandEvent(screen: number, label: GestureLabel): Ev | null {
  switch (label) {
    case 'up':
      if (screen === 12) return { type: 'FINISH' };
      return isFlowScreen(screen, 3) ? { type: 'YES' } : null;
    case 'down':
      if (screen === 12) return { type: 'EDIT' };
      if (screen === 13) return { type: 'NO' };
      return isFlowScreen(screen, 2) ? { type: 'NO' } : null;
    case 'open':
      if (screen === 6 || screen === 7) return { type: 'SPACE' };
      if (screen === 12) return { type: 'NEW_SENTENCE' };
      return null;
    case 'fist':
      return [6, 7, 9, 10, 11].includes(screen) ? { type: 'DELETE' } : null;
    default:
      return null;
  }
}

const COMMAND_LABELS: GestureLabel[] = ['open', 'fist', 'up', 'down'];

/**
 * Turns hand frames into machine events. It owns no DOM and no React: `step()` takes a frame and
 * the current screen and returns the events to send plus what the UI should show. That makes the
 * whole gesture layer testable without a camera.
 */
export class GestureController {
  readonly dwell: DwellEngine;
  private readonly stab = new Map<string, GestureStabilizer>();
  private readonly lastSeen = new Map<string, number>();
  private readonly filter = new PointerFilter();
  private lastPointer: Pt | null = null;
  private lastPointerT = -Infinity;
  private lastScreen = -1;
  private justChanged = false;

  private cmdLabel: GestureLabel | null = null;
  private blockedLabel: GestureLabel | null = null;
  private helpArmed = true;
  private wakeFired = false;
  private noHandSince: number | null = null;
  private backSince: number | null = null;
  private lost = false;
  private checksSince: number | null = null;
  private checksFired = false;

  constructor(private readonly getTargets: () => Target[] = () => []) {
    this.dwell = new DwellEngine();
  }

  private track(frame: HandFrame, inp: ControllerInput): TrackedHand[] {
    const { t } = frame;
    // MediaPipe can label both hands the same; keep them apart by position
    const sorted = [...frame.hands].sort(
      (a, b) => mirror(palmCenter(a)).x - mirror(palmCenter(b)).x,
    );
    const keys = new Set<string>();
    const out: TrackedHand[] = [];
    sorted.forEach((obs, i) => {
      let key: string = obs.handedness;
      if (keys.has(key)) key = key === 'Left' ? 'Right' : 'Left';
      if (sorted.length === 2 && i === 1 && keys.size === 0) key = 'Right';
      keys.add(key);
      let s = this.stab.get(key);
      if (!s) {
        s = new GestureStabilizer();
        this.stab.set(key, s);
      }
      const r = obs.score < 0.5 ? null : classify(obs, frame.width, frame.height);
      const g = s.update(r ? r.label : 'none', t);
      this.lastSeen.set(key, t);
      out.push({
        obs,
        g,
        conf: r ? r.confidence : 0,
        side: sideOf(obs),
        inZone: inCommandZone(obs, inp.signingHand),
      });
    });
    // hands that are no longer visible: let their gesture run out, then forget them
    for (const [key, s] of this.stab) {
      if (keys.has(key)) continue;
      s.update('none', t);
      if (t - (this.lastSeen.get(key) ?? t) > 500) s.reset();
    }
    return out;
  }

  step(frame: HandFrame, inp: ControllerInput): { events: Ev[]; ui: VisionUI } {
    const { t } = frame;
    const events: Ev[] = [];
    if (inp.screen !== this.lastScreen) {
      this.lastScreen = inp.screen;
      this.justChanged = true;
      this.dwell.reset();
      this.wakeFired = false;
      this.checksSince = null;
      this.checksFired = false;
    }
    this.dwell.adaptive.setMode(inp.dwell ?? 'auto');
    const hands = this.track(frame, inp);
    const n = hands.length;

    // --- both hands open, held: help (any screen)
    const bothOpen = n >= 2 && hands[0].g.label === 'open' && hands[1].g.label === 'open';
    let help = 0;
    if (bothOpen) {
      const since = Math.max(hands[0].g.since, hands[1].g.since);
      help = Math.min(1, (t - since) / HOLD.help);
      if (help >= 1 && this.helpArmed) {
        events.push({ type: 'HELP_TOGGLE' });
        this.helpArmed = false;
      }
    } else {
      this.helpArmed = true;
    }
    if (!this.helpArmed) help = 0;

    // --- hand lost / back (screens that need a hand)
    if (inp.needsHand) {
      if (n === 0) {
        this.backSince = null;
        if (this.noHandSince === null) this.noHandSince = t;
        if (!this.lost && t - this.noHandSince >= HAND_LOST_MS) {
          events.push({ type: 'HAND_LOST' });
          this.lost = true;
        }
      } else {
        this.noHandSince = null;
        if (this.lost) {
          if (this.backSince === null) this.backSince = t;
          if (t - this.backSince >= HAND_BACK_MS) {
            events.push({ type: 'HAND_BACK' });
            this.lost = false;
            this.backSince = null;
          }
        }
      }
    } else {
      this.noHandSince = null;
      this.backSince = null;
      this.lost = false;
    }

    // --- wake: open hand held (screen 1)
    let wake = 0;
    if (inp.screen === 1 && !bothOpen && !this.wakeFired) {
      const open = hands.find((h) => h.g.label === 'open');
      if (open) {
        wake = Math.min(1, (t - open.g.since) / HOLD.wake);
        if (wake >= 1) {
          events.push({ type: 'WAKE' });
          this.wakeFired = true;
        }
      }
    }

    // --- setup checks all green for a while (screen 2)
    if (inp.screen === 2) {
      if (inp.checks?.allOk) {
        if (this.checksSince === null) this.checksSince = t;
        if (!this.checksFired && t - this.checksSince >= CHECKS_HOLD_MS) {
          events.push({ type: 'CHECKS_PASSED' });
          this.checksFired = true;
        }
      } else {
        this.checksSince = null;
      }
    }

    // --- pointer + dwell (not while both hands are up for help, or while the hand is lost)
    const pointing = hands.find((h) => h.g.label === 'point');
    let pointer: Pt | null = null;
    if (pointing && !bothOpen && !this.lost) {
      const tip = pointing.obs.landmarks[LM.INDEX_TIP];
      pointer = this.filter.filter(cameraToScreen(tip, inp.viewport.w, inp.viewport.h), t);
      this.lastPointer = pointer;
      this.lastPointerT = t;
    } else if (t - this.lastPointerT <= POINTER_GRACE_MS && !bothOpen && !this.lost) {
      pointer = this.lastPointer;
    } else {
      this.filter.reset();
      this.lastPointer = null;
    }
    const d = this.dwell.update(pointer, this.getTargets(), t);
    if (d.fired) events.push(d.fired.event);

    // --- command gestures
    const zoneOnly = ZONE_ONLY_SCREENS.has(inp.screen);
    const candidates = hands.filter(
      (h) => COMMAND_LABELS.includes(h.g.label) && (!zoneOnly || h.inZone),
    );
    const cmdHand = candidates.find((h) => h.inZone) ?? candidates[0] ?? null;
    const label = !bothOpen && !this.lost && cmdHand ? cmdHand.g.label : null;
    if (this.justChanged) {
      // a gesture that is still held from the previous screen must be released first
      this.blockedLabel = label;
      this.justChanged = false;
    }
    if (label !== this.cmdLabel) this.cmdLabel = label;
    if (this.blockedLabel && label !== this.blockedLabel) this.blockedLabel = null;
    const cmd = label ? commandEvent(inp.screen, label) : null;
    let cmdProgress = 0;
    if (label && cmd && cmdHand && label !== this.blockedLabel) {
      const hold = HOLD[label as keyof typeof HOLD];
      cmdProgress = Math.min(1, (t - cmdHand.g.since) / hold);
      if (cmdProgress >= 1) {
        events.push(cmd);
        this.blockedLabel = label;
        cmdProgress = 0;
      }
    }

    // anything that fired changes the screen next frame: hold the next gesture until it is released
    const ui: VisionUI = {
      hands: n,
      handViews: hands.map((h) => ({
        side: h.side,
        gesture: h.g.label,
        confidence: h.conf,
        inZone: h.inZone,
      })),
      pointer,
      dwell: { id: d.fired ? null : d.targetId, progress: d.progress, ms: this.dwell.adaptive.ms },
      wake,
      help,
      command: { label: cmd && label !== this.blockedLabel ? label : null, progress: cmdProgress },
      handLost: this.lost,
    };
    return { events, ui };
  }
}
