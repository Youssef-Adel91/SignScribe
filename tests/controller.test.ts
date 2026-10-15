import { describe, expect, it } from 'vitest';
import { GestureController, commandEvent, type ControllerInput } from '../src/vision/controller';
import type { Target } from '../src/vision/dwell';
import { evaluateChecks } from '../src/vision/checks';
import { cameraToScreen } from '../src/vision/pointer';
import { makeFrame, makeHand, type Pose } from '../src/vision/testing/fixtures';
import type { Ev } from '../src/state/machine';
import type { HandObs } from '../src/vision/types';

const VP = { w: 1280, h: 720 };
const input = (screen: number, over: Partial<ControllerInput> = {}): ControllerInput => ({
  screen,
  signingHand: 'right',
  needsHand: false,
  viewport: VP,
  checks: null,
  ...over,
});

/** drives a GestureController at 30 fps and records every event with its time */
class Sim {
  t = 1000;
  log: { t: number; e: Ev }[] = [];
  last = null as ReturnType<GestureController['step']>['ui'] | null;
  constructor(
    public c: GestureController,
    public inp: ControllerInput,
  ) {}
  run(ms: number, hands: HandObs[] | (() => HandObs[])) {
    const end = this.t + ms;
    for (; this.t < end; this.t += 33) {
      const r = this.c.step(
        makeFrame(this.t, typeof hands === 'function' ? hands() : hands),
        this.inp,
      );
      this.last = r.ui;
      for (const e of r.events) this.log.push({ t: this.t, e });
    }
  }
  types() {
    return this.log.map((l) => l.e.type);
  }
  clear() {
    this.log = [];
  }
}

/** raw camera x for a hand placed in the command zone of a right-handed signer (zone on the mirrored left) */
const ZONE = { cx: 0.8, cy: 0.5 }; // un-mirrored 0.8 -> mirrored 0.2
const SIGNING = { cx: 0.25, cy: 0.5 }; // mirrored 0.75
const hand = (pose: Pose, o = {}) => makeHand(pose, { size: 0.2, ...o });

describe('wake (screen 1)', () => {
  it('open hand held 2 s sends WAKE once, and not earlier', () => {
    const s = new Sim(new GestureController(), input(1));
    s.run(1500, [hand('open')]);
    expect(s.types()).toEqual([]);
    expect(s.last!.wake).toBeGreaterThan(0.4);
    s.run(1000, [hand('open')]);
    expect(s.types()).toEqual(['WAKE']);
    const t = s.log[0].t - 1000;
    expect(t).toBeGreaterThanOrEqual(2000);
    expect(t).toBeLessThan(2300);
  });
  it('does not wake for a fist, a pointing hand or thumbs up', () => {
    for (const pose of ['fist', 'point', 'thumbsUp'] as const) {
      const s = new Sim(new GestureController(), input(1));
      s.run(3000, [hand(pose)]);
      expect(s.types(), pose).toEqual([]);
    }
  });
  it('lowering the hand early resets the progress', () => {
    const s = new Sim(new GestureController(), input(1));
    s.run(1500, [hand('open')]);
    s.run(600, []);
    s.run(1500, [hand('open')]);
    expect(s.types()).toEqual([]);
  });
  it('a one-frame detection glitch does not restart the wake hold', () => {
    const s = new Sim(new GestureController(), input(1));
    s.run(1200, [hand('open')]);
    s.run(33, []);
    s.run(1200, [hand('open')]);
    expect(s.types()).toEqual(['WAKE']);
  });
});

describe('help: both hands open', () => {
  const both = () => [
    hand('open', { cx: 0.3, handedness: 'Left' }),
    hand('open', { cx: 0.7, handedness: 'Right' }),
  ];
  it('held 1 s sends HELP_TOGGLE once, on any screen', () => {
    for (const screen of [1, 5, 6, 11, 13]) {
      const s = new Sim(new GestureController(), input(screen));
      s.run(2500, both());
      expect(s.types(), `screen ${screen}`).toEqual(['HELP_TOGGLE']);
    }
  });
  it('lowering the hands and raising them again toggles again', () => {
    const s = new Sim(new GestureController(), input(5));
    s.run(1500, both());
    s.run(600, []);
    s.run(1500, both());
    expect(s.types()).toEqual(['HELP_TOGGLE', 'HELP_TOGGLE']);
  });
  it('does not wake on screen 1 while both hands are up', () => {
    const s = new Sim(new GestureController(), input(1));
    s.run(3000, both());
    expect(s.types()).toEqual(['HELP_TOGGLE']);
  });
  it('works when MediaPipe gives both hands the same label', () => {
    const s = new Sim(new GestureController(), input(5));
    s.run(1500, [
      hand('open', { cx: 0.3, handedness: 'Right' }),
      hand('open', { cx: 0.7, handedness: 'Right' }),
    ]);
    expect(s.types()).toEqual(['HELP_TOGGLE']);
  });
});

describe('thumbs and the same-meaning-everywhere rule', () => {
  it('thumbs up = YES on setup screens, once per hold', () => {
    for (const screen of [3, 4, 5, 9, 11]) {
      const s = new Sim(new GestureController(), input(screen));
      s.run(2500, [hand('thumbsUp')]);
      expect(s.types(), `screen ${screen}`).toEqual(['YES']);
    }
  });
  it('thumbs down = NO', () => {
    for (const screen of [2, 3, 4, 5, 6, 9, 10, 11]) {
      const s = new Sim(
        new GestureController(),
        input(screen, { needsHand: [6, 9, 10].includes(screen) }),
      );
      s.run(2500, [hand('thumbsDown', ZONE)]);
      expect(s.types(), `screen ${screen}`).toEqual(['NO']);
    }
  });
  it('needs 0.6 s: a quick thumbs up does nothing', () => {
    const s = new Sim(new GestureController(), input(5));
    s.run(350, [hand('thumbsUp')]);
    s.run(1000, []);
    expect(s.types()).toEqual([]);
  });
  it('release and repeat sends it again', () => {
    const s = new Sim(new GestureController(), input(5));
    s.run(1200, [hand('thumbsUp')]);
    s.run(600, []);
    s.run(1200, [hand('thumbsUp')]);
    expect(s.types()).toEqual(['YES', 'YES']);
  });
  it('screen 12: up = FINISH, down = EDIT, open palm = NEW_SENTENCE', () => {
    for (const [pose, ev] of [
      ['thumbsUp', 'FINISH'],
      ['thumbsDown', 'EDIT'],
      ['open', 'NEW_SENTENCE'],
    ] as const) {
      const s = new Sim(new GestureController(), input(12));
      s.run(1500, [hand(pose)]);
      expect(s.types(), pose).toEqual([ev]);
    }
  });
  it('nothing happens for thumbs on the welcome screen', () => {
    const s = new Sim(new GestureController(), input(1));
    s.run(2500, [hand('thumbsUp')]);
    expect(s.types()).toEqual([]);
  });
});

describe('command zone on the spelling screens', () => {
  const inp = () => input(6, { needsHand: true });
  it('open palm in the zone for 0.5 s = SPACE', () => {
    const s = new Sim(new GestureController(), inp());
    s.run(900, [hand('open', ZONE)]);
    expect(s.types()).toEqual(['SPACE']);
  });
  it('open palm in the signing area is NOT a command', () => {
    const s = new Sim(new GestureController(), inp());
    s.run(2000, [hand('open', SIGNING)]);
    expect(s.types()).toEqual([]);
  });
  it('fist in the zone = DELETE; in the signing area it is a letter, not a command', () => {
    const a = new Sim(new GestureController(), inp());
    a.run(900, [hand('fist', ZONE)]);
    expect(a.types()).toEqual(['DELETE']);
    const b = new Sim(new GestureController(), inp());
    b.run(2000, [hand('fist', SIGNING)]);
    expect(b.types()).toEqual([]);
  });
  it('thumbs up in the signing area does nothing, in the zone it is YES (Done)', () => {
    const a = new Sim(new GestureController(), inp());
    a.run(2000, [hand('thumbsUp', SIGNING)]);
    expect(a.types()).toEqual([]);
    const b = new Sim(new GestureController(), inp());
    b.run(1200, [hand('thumbsUp', ZONE)]);
    expect(b.types()).toEqual(['YES']);
  });
  it('the zone is on the other side for a left-handed signer', () => {
    const s = new Sim(new GestureController(), input(6, { needsHand: true, signingHand: 'left' }));
    s.run(900, [hand('open', ZONE)]); // zone is now on the right: ZONE (mirrored 0.2) is the signing side
    expect(s.types()).toEqual([]);
    s.run(900, [hand('open', { cx: 0.2, cy: 0.5 })]); // mirrored 0.8 = right side
    expect(s.types()).toEqual(['SPACE']);
  });
  it('the signing hand keeps making letters while the other hand does a command', () => {
    const s = new Sim(new GestureController(), inp());
    s.run(1200, [hand('fist', SIGNING), hand('open', { ...ZONE, handedness: 'Left' })]);
    expect(s.types()).toEqual(['SPACE']);
  });
});

describe('hand lost and back', () => {
  it('no hand for 1 s on a spelling screen sends HAND_LOST once, and HAND_BACK after 0.3 s', () => {
    const s = new Sim(new GestureController(), input(6, { needsHand: true }));
    s.run(500, [hand('open', SIGNING)]);
    s.run(800, []);
    expect(s.types()).toEqual([]);
    s.run(800, []);
    expect(s.types()).toEqual(['HAND_LOST']);
    s.run(2000, []);
    expect(s.types()).toEqual(['HAND_LOST']);
    s.run(200, [hand('open', SIGNING)]);
    expect(s.types()).toEqual(['HAND_LOST']);
    s.run(300, [hand('open', SIGNING)]);
    expect(s.types()).toEqual(['HAND_LOST', 'HAND_BACK']);
  });
  it('is not sent on screens that do not need a hand', () => {
    const s = new Sim(new GestureController(), input(3, { needsHand: false }));
    s.run(5000, []);
    expect(s.types()).toEqual([]);
  });
  it('a hand that flickers for 0.3 s does not pause spelling', () => {
    const s = new Sim(new GestureController(), input(7, { needsHand: true }));
    s.run(500, [hand('fist', SIGNING)]);
    s.run(300, []);
    s.run(500, [hand('fist', SIGNING)]);
    expect(s.types()).toEqual([]);
  });
  it('commands are ignored while the hand is lost, and the held gesture must be released after it returns', () => {
    const s = new Sim(new GestureController(), input(6, { needsHand: true }));
    s.run(1500, []);
    expect(s.types()).toEqual(['HAND_LOST']);
    s.run(1500, [hand('open', ZONE)]);
    // returns with an open palm in the zone: HAND_BACK, then SPACE once it has been held
    expect(s.types()[1]).toBe('HAND_BACK');
  });
});

describe('pointing and dwell', () => {
  const targets = (): Target[] => [
    {
      id: 'left',
      rect: { x: 200, y: 250, w: 300, h: 200 },
      event: { type: 'CHOOSE_HAND', hand: 'left' },
    },
    {
      id: 'right',
      rect: { x: 700, y: 250, w: 300, h: 200 },
      event: { type: 'CHOOSE_HAND', hand: 'right' },
    },
  ];
  /** a pointing hand whose fingertip lands on the given viewport pixel */
  const pointAt = (sx: number, sy: number): HandObs => {
    const tip = makeHand('point', { size: 0.2 }).landmarks[8];
    const off = { x: tip.x - 0.5, y: tip.y - 0.5 };
    const m = 0.12;
    const span = 1 - 2 * m;
    const want = { x: 1 - m - (span * sx) / VP.w, y: m + (span * sy) / VP.h };
    return makeHand('point', { size: 0.2, cx: want.x - off.x, cy: want.y - off.y });
  };
  it('point-and-hold on a target sends its event after about 0.8 s', () => {
    const s = new Sim(new GestureController(targets), input(3));
    const h = pointAt(850, 350);
    const p = cameraToScreen(h.landmarks[8], VP.w, VP.h);
    expect(Math.abs(p.x - 850)).toBeLessThan(30);
    expect(Math.abs(p.y - 350)).toBeLessThan(30);
    s.run(600, [h]);
    expect(s.types()).toEqual([]);
    s.run(1200, [h]);
    expect(s.types()).toEqual(['CHOOSE_HAND']);
    expect(s.log[0].e).toEqual({ type: 'CHOOSE_HAND', hand: 'right' });
  });
  it('reports the ring progress while holding', () => {
    const s = new Sim(new GestureController(targets), input(3));
    s.run(500, [pointAt(850, 350)]);
    expect(s.last!.dwell.id).toBe('right');
    expect(s.last!.dwell.progress).toBeGreaterThan(0.2);
    expect(s.last!.dwell.progress).toBeLessThan(1);
    expect(s.last!.pointer).not.toBeNull();
  });
  it('moving away before the end selects nothing', () => {
    const s = new Sim(new GestureController(targets), input(3));
    s.run(500, [pointAt(850, 350)]);
    s.run(1500, [pointAt(640, 650)]);
    expect(s.types()).toEqual([]);
  });
  it('an open palm or a fist over a target never selects it', () => {
    for (const pose of ['open', 'fist'] as const) {
      const s = new Sim(new GestureController(targets), input(3));
      s.run(2000, [makeHand(pose, { size: 0.2, cx: 0.4, cy: 0.5 })]);
      expect(
        s.types().filter((t) => t === 'CHOOSE_HAND'),
        pose,
      ).toEqual([]);
    }
  });
  it('a pointing hand moves the pointer and a tiny hand jitter does not change the choice', () => {
    const s = new Sim(new GestureController(targets), input(3));
    let i = 0;
    s.run(1500, () => [pointAt(850 + ((i++ % 2) * 2 - 1) * 6, 350)]);
    expect(s.types()).toEqual(['CHOOSE_HAND']);
  });
});

describe('screen changes', () => {
  it('a thumbs up still held after the screen changed does not fire on the new screen', () => {
    const s = new Sim(new GestureController(), input(11));
    s.run(1000, [hand('thumbsUp')]);
    expect(s.types()).toEqual(['YES']);
    s.inp = input(12); // machine moved to share
    s.run(2000, [hand('thumbsUp')]);
    expect(s.types()).toEqual(['YES']); // no FINISH yet
    s.run(500, []);
    s.run(1200, [hand('thumbsUp')]);
    expect(s.types()).toEqual(['YES', 'FINISH']);
  });
  it('a held gesture is not blocked forever: a different one works at once', () => {
    const s = new Sim(new GestureController(), input(11));
    s.run(1000, [hand('thumbsUp')]);
    s.inp = input(12);
    s.run(1200, [hand('thumbsDown')]);
    expect(s.types()).toEqual(['YES', 'EDIT']);
  });
});

describe('setup checks (screen 2)', () => {
  const good = (t: number) => evaluateChecks(140, makeFrame(t, [hand('open', { cx: 0.5 })]));
  it('CHECKS_PASSED after the checks stay green for 1.5 s', () => {
    const s = new Sim(new GestureController(), input(2, { checks: good(0) }));
    s.run(1200, [hand('open')]);
    expect(s.types()).toEqual([]);
    s.run(600, [hand('open')]);
    expect(s.types()).toEqual(['CHECKS_PASSED']);
  });
  it('a failing check restarts the timer', () => {
    const s = new Sim(new GestureController(), input(2, { checks: good(0) }));
    s.run(1200, [hand('open')]);
    s.inp = input(2, { checks: evaluateChecks(20, null) });
    s.run(200, [hand('open')]);
    s.inp = input(2, { checks: good(0) });
    s.run(1200, [hand('open')]);
    expect(s.types()).toEqual([]);
    s.run(600, [hand('open')]);
    expect(s.types()).toEqual(['CHECKS_PASSED']);
  });
});

describe('evaluateChecks', () => {
  const f = (pose: Pose, o = {}) => makeFrame(0, [makeHand(pose, o)]);
  it('dark and bright rooms are flagged', () => {
    expect(evaluateChecks(30, f('open')).light.state).toBe('warn');
    expect(evaluateChecks(250, f('open')).light.state).toBe('warn');
    expect(evaluateChecks(140, f('open')).light.state).toBe('ok');
    expect(evaluateChecks(null, f('open')).light.state).toBe('wait');
  });
  it('far and close hands are flagged', () => {
    expect(evaluateChecks(140, f('open', { size: 0.05 })).distance.state).toBe('warn');
    expect(evaluateChecks(140, f('open', { size: 0.6, cx: 0.5, cy: 0.5 })).distance.state).toBe(
      'warn',
    );
    expect(evaluateChecks(140, f('open', { size: 0.2 })).distance.state).toBe('ok');
  });
  it('a hand cut off by the frame edge is flagged', () => {
    expect(evaluateChecks(140, f('open', { size: 0.2, cx: 0.98 })).hand.state).toBe('warn');
    expect(evaluateChecks(140, f('open', { size: 0.2 })).hand.state).toBe('ok');
  });
  it('no hand means waiting, not ok', () => {
    const c = evaluateChecks(140, makeFrame(0, []));
    expect(c.hand.state).toBe('wait');
    expect(c.allOk).toBe(false);
  });
});

describe('commandEvent table', () => {
  it('matches the hints on screen', () => {
    expect(commandEvent(11, 'up')).toEqual({ type: 'YES' });
    expect(commandEvent(11, 'down')).toEqual({ type: 'NO' });
    expect(commandEvent(11, 'fist')).toEqual({ type: 'DELETE' });
    expect(commandEvent(6, 'open')).toEqual({ type: 'SPACE' });
    expect(commandEvent(10, 'open')).toBeNull();
    expect(commandEvent(8, 'up')).toBeNull();
    expect(commandEvent(1, 'down')).toBeNull();
  });
});
