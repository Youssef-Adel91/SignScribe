import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LetterController, handSpeed, type LetterUI } from '../src/recognition/letterController';
import { LetterLog, LOG_HEAD, letterLog, rowOf } from '../src/recognition/letterLog';
import { commandState, dropLettersWithCommand } from '../src/recognition/priority';
import {
  ALPHABET_TUNING,
  DEFAULT_TUNING,
  RANGES,
  TUNING_KEYS,
  clearSavedTuning,
  resolveTuning,
  sanitize,
  saveTuning,
  type LetterTuning,
} from '../src/recognition/tuning';
import type { LetterGuess, StaticRecognizer } from '../src/recognition/types';
import type { Ev } from '../src/state/machine';
import { makeFrame, makeHand } from '../src/vision/testing/fixtures';
import type { HandObs } from '../src/vision/types';
import type { VisionUI } from '../src/vision/controller';

class Fake implements StaticRecognizer {
  id = 'knn';
  calls = 0;
  guess: LetterGuess | null = null;
  recognize() {
    this.calls++;
    return this.guess;
  }
}
const g = (letter: string, confidence = 0.95, second = 0.02): LetterGuess => ({
  letter,
  confidence,
  alternatives: [
    { letter: 'X', confidence: second },
    { letter: 'Y', confidence: 0.01 },
  ],
});

const SIGNING = { cx: 0.25, cy: 0.5 };
const ZONE = { cx: 0.8, cy: 0.5 };
const MS = 33;

/** a test tuning that is easy to reason about */
const T: LetterTuning = {
  ...DEFAULT_TUNING.knn,
  stableMs: 200,
  holdMs: 600,
  releaseMs: 200,
  cooldownMs: 400,
  maxSpeed: 0.35,
  stillFrames: 4,
  commandHoldoffMs: 500,
  minMargin: 0.1,
};

class Sim {
  t = 1000;
  log: { t: number; e: Ev }[] = [];
  ui!: LetterUI;
  constructor(
    public c: LetterController,
    public screen = 6,
  ) {}
  /** hands is a function of the step number so a hand can move */
  run(
    ms: number,
    hands: HandObs[] | ((i: number) => HandObs[]),
    command?: { active: boolean; fired: boolean },
  ) {
    const end = this.t + ms;
    let i = 0;
    for (; this.t < end; this.t += MS, i++) {
      const hs = typeof hands === 'function' ? hands(i) : hands;
      const r = this.c.step(makeFrame(this.t, hs), {
        screen: this.screen,
        signingHand: 'right',
        command,
      });
      this.ui = r.ui;
      for (const e of r.events) this.log.push({ t: this.t, e });
    }
    return this.ui;
  }
  types() {
    return this.log.map((l) => l.e.type);
  }
  letters() {
    return this.log
      .filter((l) => l.e.type === 'LETTER_CONFIRMED')
      .map((l) => (l.e as { letter: string }).letter);
  }
}
const still = (o = SIGNING) => [makeHand('fist', o)];
/** a hand that shakes: moves a quarter of a palm length every frame */
const shaking = (i: number) => [
  makeHand('fist', { cx: SIGNING.cx + (i % 2 ? 0.05 : -0.05), cy: SIGNING.cy }),
];

describe('1. what the debug overlay shows', () => {
  it('every frame has the state, the speed, the still counter and the top 3', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    const ui = s.run(900, still());
    expect(ui.raw.map((r) => r.letter)).toEqual(['B', 'X', 'Y']);
    expect(ui.debug).toMatchObject({ state: expect.any(String), stillFrames: 4 });
    expect(ui.debug.stillCount).toBeGreaterThanOrEqual(4);
    expect(ui.debug.speed).toBeCloseTo(0, 5);
  });
  it('the log has one row per frame with the same numbers, as CSV, and no landmarks', () => {
    const log = new LetterLog();
    const ui: LetterUI = {
      guess: null,
      raw: [
        { letter: 'A', confidence: 0.9 },
        { letter: 'B', confidence: 0.05 },
      ],
      progress: 0,
      tracingMotion: false,
      debug: {
        state: 'moving',
        speed: 1.5,
        stillCount: 0,
        stillFrames: 4,
        stableMs: 0,
        cooldownLeftMs: 0,
        commandLeftMs: 0,
        rejectedBecause: '',
      },
    };
    log.record(
      rowOf(1234, 6, ui, { active: true, fired: false, label: 'fist' }, ['DELETE'], 'asl/knn'),
    );
    const [head, row] = log.toCsv().trim().split('\n');
    expect(head.split(',')).toEqual([...LOG_HEAD]);
    expect(row.split(',')[2]).toBe('moving');
    expect(row).toContain('A,0.900,B,0.050');
    expect(row).toContain('DELETE');
    expect(log.toCsv()).not.toMatch(/landmark/i);
  });
  it('the log keeps the latest rows only', () => {
    const log = new LetterLog(3);
    for (let i = 0; i < 5; i++)
      log.record({
        ...rowOf(
          i,
          6,
          {
            guess: null,
            raw: [],
            progress: 0,
            tracingMotion: false,
            debug: {
              state: 'x',
              speed: 0,
              stillCount: 0,
              stillFrames: 0,
              stableMs: 0,
              cooldownLeftMs: 0,
              commandLeftMs: 0,
              rejectedBecause: '',
            },
          },
          { active: false, fired: false, label: '' },
          [],
          '',
        ),
      });
    expect(log.rows.map((r) => r.t)).toEqual([2, 3, 4]);
  });
  it('the overlay renders the numbers and is behind ?letterdebug=1', async () => {
    const { visionStore } = await import('../src/vision/store');
    const { LetterDebug } = await import('../src/dev/LetterDebug');
    visionStore.set({
      letters: {
        ...visionStore.state.letters,
        status: 'ready',
        alphabetId: 'arsl',
        modelId: 'mlp',
        tuning: DEFAULT_TUNING.mlp,
        ui: {
          guess: null,
          raw: [
            { letter: 'ain', confidence: 0.97 },
            { letter: 'bb', confidence: 0.02 },
            { letter: 'dal', confidence: 0.01 },
          ],
          progress: 0.4,
          tracingMotion: false,
          debug: {
            state: 'holding',
            speed: 0.12,
            stillCount: 9,
            stillFrames: 5,
            stableMs: 410,
            cooldownLeftMs: 0,
            commandLeftMs: 0,
            rejectedBecause: '',
          },
        },
      },
    });
    const html = renderToStaticMarkup(createElement(LetterDebug));
    for (const needle of [
      'holding',
      'ain 97%',
      'bb 2%',
      'dal 1%',
      '0.12',
      '9 / 5',
      'arsl/mlp',
      'Download log',
    ])
      expect(html).toContain(needle);
    visionStore.reset();
  });
  it('the flag is read from the address', async () => {
    window.history.pushState({}, '', '/?letterdebug=1');
    vi.resetModules();
    expect((await import('../src/vision/store')).LETTER_DEBUG).toBe(true);
    window.history.pushState({}, '', '/');
    vi.resetModules();
    expect((await import('../src/vision/store')).LETTER_DEBUG).toBe(false);
    const app = (await import('node:fs')).readFileSync('src/app/App.tsx', 'utf8');
    expect(app).toMatch(/LETTER_DEBUG && <LetterDebug \/>/);
  });
  it('the downloaded log is git-ignored', async () => {
    const { spawnSync } = await import('node:child_process');
    expect(
      spawnSync('git', ['check-ignore', '-q', 'signscribe-letterdebug-2026-10-31.csv']).status,
    ).toBe(0);
    expect(letterLog).toBeInstanceOf(LetterLog);
  });
});

describe('2. motion gating, hold, release and cooldown', () => {
  it('measures speed in palm lengths per second over all landmarks', () => {
    const a = makeHand('fist', SIGNING).landmarks;
    const b = makeHand('fist', { cx: SIGNING.cx + 0.01, cy: SIGNING.cy }).landmarks;
    expect(handSpeed(a, a, 640, 480, 50, 33)).toBe(0);
    const v = handSpeed(a, b, 640, 480, 50, 33);
    expect(v).toBeGreaterThan(0);
    expect(handSpeed(a, b, 640, 480, 50, 66)).toBeCloseTo(v / 2, 6);
    expect(handSpeed(a, b, 640, 480, 0, 33)).toBe(0);
  });
  it('a shaking hand is never classified, even for a letter the model is sure of', () => {
    const f = new Fake();
    f.guess = g('B', 0.99);
    const s = new Sim(new LetterController(f, null, T));
    const ui = s.run(3000, shaking);
    expect(f.calls).toBe(0);
    expect(s.log).toEqual([]);
    expect(ui.debug.state).toBe('moving');
    expect(ui.raw).toEqual([]);
  });
  it('waits for N still frames before the first classification', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, { ...T, stillFrames: 6 }));
    s.run(MS * 5, still());
    expect(f.calls).toBe(0);
    s.run(MS * 4, still());
    expect(f.calls).toBeGreaterThan(0);
    expect(s.ui.debug.state).not.toBe('settling');
  });
  it('slow drift under the limit is still; the hysteresis keeps a moving hand moving until it is clearly slower', () => {
    const f = new Fake();
    f.guess = g('B');
    const c = new LetterController(f, null, T);
    const s = new Sim(c);
    s.run(600, still());
    expect(s.ui.debug.state).not.toBe('moving');
    s.run(300, shaking);
    expect(s.ui.debug.state).toBe('moving');
    s.run(MS * 2, still()); // two still frames: not enough
    expect(s.ui.debug.state).toBe('moving');
  });
  it('writes the letter only after the same letter was held for the hold time', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    s.run(T.holdMs - 100, still());
    expect(s.letters()).toEqual([]);
    s.run(600, still());
    expect(s.letters()).toEqual(['B']);
  });
  it('a letter that changes resets the hold', () => {
    const f = new Fake();
    const s = new Sim(new LetterController(f, null, T));
    for (let i = 0; i < 6; i++) {
      f.guess = g(i % 2 ? 'B' : 'C');
      s.run(300, still());
    }
    expect(s.letters()).toEqual([]);
  });
  it('after a commit the same sign does not repeat while the hand stays the same', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    s.run(6000, still());
    expect(s.letters()).toEqual(['B']);
    expect(s.ui.debug.state).toBe('wait-release');
  });
  it('the hand moving away, then back, writes it again (hysteresis + release)', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    s.run(1500, still());
    s.run(500, shaking); // leaves / changes for longer than releaseMs
    s.run(2500, still());
    expect(s.letters()).toEqual(['B', 'B']);
  });
  it('a hand that leaves the picture for the release time can write the same letter again', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    s.run(1500, still());
    s.run(500, []);
    s.run(2500, still());
    expect(s.letters()).toEqual(['B', 'B']);
  });
  it('the cooldown blocks the next letter even when the hand changed at once', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, { ...T, cooldownMs: 1500 }));
    s.run(1200, still());
    expect(s.letters()).toEqual(['B']);
    const committedAt = s.log.find((l) => l.e.type === 'LETTER_CONFIRMED')!.t;
    f.guess = g('C');
    s.run(5000, still());
    const second = s.log.filter((l) => l.e.type === 'LETTER_CONFIRMED')[1];
    expect(second.t - committedAt).toBeGreaterThanOrEqual(1500 + T.holdMs - 100);
    expect(s.letters()).toEqual(['B', 'C']);
  });
  it('shows nothing and writes nothing for a hand that only passes through', () => {
    const f = new Fake();
    f.guess = g('B', 0.99);
    const s = new Sim(new LetterController(f, null, T));
    // 120 ms of stillness between two movements: under the N frames and under the stable time
    for (let k = 0; k < 6; k++) {
      s.run(300, shaking);
      s.run(MS * 3, still());
    }
    expect(s.log).toEqual([]);
  });
});

describe('3. a command has priority over a letter', () => {
  const ready = () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    return { f, s };
  };
  it('no candidate and no commit while a control gesture is active, even with a held letter', () => {
    const { s } = ready();
    s.run(5000, still(), { active: true, fired: false });
    expect(s.log).toEqual([]);
    expect(s.ui.debug.state).toBe('command');
  });
  it('a letter that was nearly written is not written when a command starts', () => {
    const { s } = ready();
    s.run(T.holdMs - 150, still());
    s.run(MS * 3, still(), { active: true, fired: false });
    s.run(3000, still()); // command over, the hand did not change
    expect(s.letters()).toEqual([]); // it must be released first
  });
  it('after the command the suppression lasts commandHoldoffMs', () => {
    const { s } = ready();
    s.run(MS, still(), { active: true, fired: true });
    s.run(T.commandHoldoffMs - 100, still());
    expect(s.ui.debug.state).toBe('command');
    expect(s.log).toEqual([]);
  });
  it('a frame that fires a command cannot also write a letter', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    s.run(T.holdMs - MS * 2, still());
    // the command frame arrives exactly when the hold would complete
    for (let i = 0; i < 6; i++) s.run(MS, still(), { active: false, fired: i === 2 });
    const committedAtFired = s.log.some((l) => l.e.type === 'LETTER_CONFIRMED');
    expect(committedAtFired).toBe(false);
  });
  it('the events of one frame: a command removes the letter events, nothing else', () => {
    const cmd: Ev[] = [{ type: 'DELETE' }];
    const letters: Ev[] = [
      { type: 'LETTER_CANDIDATE', candidate: { letter: 'B', confidence: 1, alternatives: [] } },
      { type: 'LETTER_CONFIRMED', letter: 'B' },
      { type: 'CANDIDATE_LOST' },
    ];
    expect(dropLettersWithCommand(cmd, letters).map((e) => e.type)).toEqual(['CANDIDATE_LOST']);
    expect(dropLettersWithCommand([], letters)).toHaveLength(3);
    for (const c of ['SPACE', 'YES', 'NO', 'FINISH'])
      expect(
        dropLettersWithCommand([{ type: c }], letters).some((e) => e.type === 'LETTER_CONFIRMED'),
      ).toBe(false);
  });
  const vui = (over: Partial<VisionUI> = {}): VisionUI => ({
    hands: 1,
    handViews: [],
    pointer: null,
    dwell: { id: null, progress: 0, ms: 800 },
    wake: 0,
    help: 0,
    command: { label: null, progress: 0 },
    handLost: false,
    ...over,
  });
  it('commandState: a recognised control gesture, a fired event, the pointer in the zone, a posing zone hand', () => {
    expect(commandState(vui(), [], 'right', 1000).active).toBe(false);
    expect(
      commandState(vui({ command: { label: 'fist', progress: 0.3 } }), [], 'right', 1000).active,
    ).toBe(true);
    expect(commandState(vui(), ['DELETE'], 'right', 1000)).toEqual({ active: true, fired: true });
    expect(commandState(null, ['SPACE'], 'right', 1000).fired).toBe(true);
    // right-handed signer: the zone is the mirrored left, x <= 40% of the screen
    expect(commandState(vui({ pointer: { x: 200, y: 300 } }), [], 'right', 1000).active).toBe(true);
    expect(commandState(vui({ pointer: { x: 700, y: 300 } }), [], 'right', 1000).active).toBe(
      false,
    );
    expect(commandState(vui({ pointer: { x: 900, y: 300 } }), [], 'left', 1000).active).toBe(true);
    const hand = (gesture: 'fist' | 'none') => ({
      side: 'left' as const,
      gesture,
      confidence: 0.9,
      inZone: true,
    });
    expect(commandState(vui({ handViews: [hand('fist')] }), [], 'right', 1000).active).toBe(true);
    expect(commandState(vui({ handViews: [hand('none')] }), [], 'right', 1000).active).toBe(false); // a resting hand does not block
  });
  it('a signing hand and a command hand: the zone hand is never read as a letter', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    s.run(2000, [makeHand('fist', ZONE)]);
    expect(f.calls).toBe(0);
  });
});

describe('5. "none" and the reject options', () => {
  const run = (guess: LetterGuess, tuning = T) => {
    const f = new Fake();
    f.guess = guess;
    const s = new Sim(new LetterController(f, null, tuning));
    s.run(3000, still());
    return s;
  };
  it('a "none" answer is shown as nothing and never written, however confident', () => {
    const s = run(g('none', 0.99));
    expect(s.log).toEqual([]);
    expect(s.ui.guess).toBeNull();
    expect(s.ui.debug.state).toBe('rejected');
    expect(s.ui.debug.rejectedBecause).toBe('none');
    expect(s.ui.raw[0].letter).toBe('none'); // the overlay still shows what the model said
  });
  it('a low confidence is shown as nothing', () => {
    const s = run(g('B', 0.5));
    expect(s.log).toEqual([]);
    expect(s.ui.debug.rejectedBecause).toBe('low-confidence');
  });
  it('a small margin between the best and the second best is shown as nothing', () => {
    const s = run(g('B', 0.8, 0.75));
    expect(s.log).toEqual([]);
    expect(s.ui.debug.rejectedBecause).toBe('small-margin');
    expect(run(g('B', 0.8, 0.75), { ...T, minMargin: 0 }).letters()).toEqual(['B']);
  });
  it('a clear answer is not rejected', () => {
    expect(run(g('B', 0.95, 0.02)).letters()).toEqual(['B']);
  });
});

describe('6. thresholds are settings per model type and alphabet', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    delete ALPHABET_TUNING.testalpha;
    localStorage.clear();
  });
  it('the neural network has its own, stricter defaults than the k-NN', () => {
    const k = resolveTuning('asl', 'knn', {});
    const m = resolveTuning('asl', 'mlp', {});
    expect(m.minConfidence).toBeGreaterThan(k.minConfidence);
    expect(m.confirmConfidence).toBeGreaterThan(k.confirmConfidence);
    expect(m).not.toEqual(k);
    expect(resolveTuning('asl', 'something-else', {})).toEqual(k);
  });
  it('an alphabet can change a model type without touching the others', () => {
    ALPHABET_TUNING.testalpha = { mlp: { minConfidence: 0.95 } };
    expect(resolveTuning('testalpha', 'mlp', {}).minConfidence).toBe(0.95);
    expect(resolveTuning('testalpha', 'knn', {})).toEqual(resolveTuning('asl', 'knn', {}));
    expect(resolveTuning('asl', 'mlp', {}).minConfidence).toBe(DEFAULT_TUNING.mlp.minConfidence);
  });
  it('saved values win, are kept per alphabet and model type, and can be removed', () => {
    saveTuning('arsl', 'mlp', { minConfidence: 0.9, holdMs: 1200 });
    expect(resolveTuning('arsl', 'mlp')).toMatchObject({ minConfidence: 0.9, holdMs: 1200 });
    expect(resolveTuning('arsl', 'knn').minConfidence).toBe(DEFAULT_TUNING.knn.minConfidence);
    expect(resolveTuning('asl', 'mlp').minConfidence).toBe(DEFAULT_TUNING.mlp.minConfidence);
    clearSavedTuning('arsl', 'mlp');
    expect(resolveTuning('arsl', 'mlp').minConfidence).toBe(DEFAULT_TUNING.mlp.minConfidence);
  });
  it('values outside their range, unknown keys and nonsense are ignored', () => {
    expect(
      sanitize({ minConfidence: 5, holdMs: -1, nope: 1, maxSpeed: 'fast', stillFrames: 3 }),
    ).toEqual({ stillFrames: 3 });
    expect(sanitize(null)).toEqual({});
    for (const k of TUNING_KEYS) expect(RANGES[k][0]).toBeLessThan(RANGES[k][1]);
  });
  it('the hold is never shorter than the time to show the candidate', () => {
    expect(
      resolveTuning('asl', 'knn', { 'asl/knn': { stableMs: 900, holdMs: 300 } }),
    ).toMatchObject({ stableMs: 900, holdMs: 950 });
  });
  it('broken storage falls back to the defaults', () => {
    localStorage.setItem('signscribe.letterTuning.v1', '{nope');
    expect(resolveTuning('asl', 'knn')).toEqual(DEFAULT_TUNING.knn);
  });
  it('the controller follows the values it is given, also when they change while it runs', () => {
    const f = new Fake();
    f.guess = g('B');
    const c = new LetterController(f, null, { ...T, holdMs: 5000 });
    const s = new Sim(c);
    s.run(2500, still());
    expect(s.letters()).toEqual([]);
    c.setTuning({ ...T, holdMs: 600 });
    s.run(200, still());
    expect(s.letters()).toEqual(['B']);
  });
  it('a controller made for the neural network uses the neural network defaults', () => {
    const mlp = new Fake();
    mlp.id = 'mlp';
    expect(new LetterController(mlp).getTuning()).toEqual(resolveTuning('asl', 'mlp', {}));
  });
});

describe('4. sound and vibration', () => {
  it('one tone and one buzz per written letter, never per frame', async () => {
    const { Feedback } = await import('../src/output/feedback');
    const out = { tone: vi.fn(), buzz: vi.fn() };
    let now = 0;
    const fb = new Feedback(out, 400, () => now);
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, null, T));
    for (let i = 0; i < 200; i++) {
      const before = s.log.length;
      s.run(MS, still());
      now = s.t;
      if (s.log.slice(before).some((l) => l.e.type === 'LETTER_CONFIRMED')) fb.letterWritten();
    }
    expect(s.letters()).toEqual(['B']);
    expect(out.tone).toHaveBeenCalledTimes(1);
    expect(out.buzz).toHaveBeenCalledTimes(1);
  });
  it('a burst of events plays once; a later letter plays again', async () => {
    const { Feedback } = await import('../src/output/feedback');
    const out = { tone: vi.fn(), buzz: vi.fn() };
    let now = 0;
    const fb = new Feedback(out, 400, () => now);
    expect(fb.letterWritten()).toBe(true);
    now = 100;
    expect(fb.letterWritten()).toBe(false);
    now = 450;
    expect(fb.letterWritten()).toBe(true);
    expect(out.tone).toHaveBeenCalledTimes(2);
  });
  it('plays nothing when the setting is off', async () => {
    const { Feedback } = await import('../src/output/feedback');
    const out = { tone: vi.fn(), buzz: vi.fn() };
    let on = false;
    const fb = new Feedback(
      out,
      400,
      () => 1000,
      () => on,
    );
    expect(fb.letterWritten()).toBe(false);
    expect(out.tone).not.toHaveBeenCalled();
    on = true;
    expect(fb.letterWritten()).toBe(true);
  });
  it('without audio or vibration the app stays silent and does not throw', async () => {
    const { feedback, setFeedbackEnabled } = await import('../src/output/feedback');
    setFeedbackEnabled(true);
    expect(() => feedback.letterWritten()).not.toThrow();
  });
  it('the setting is stored with the others and the screen has a Sounds only choice', async () => {
    const { loadSettings, saveSettings } = await import('../src/state/settings');
    const { DEFAULT_SETTINGS } = await import('../src/state/machine');
    localStorage.clear();
    expect(loadSettings().feedback).toBe(true);
    saveSettings({ ...DEFAULT_SETTINGS, feedback: false, voice: false });
    expect(loadSettings()).toMatchObject({ feedback: false, voice: false });
    localStorage.setItem('signscribe.settings.v2', JSON.stringify({ feedback: 'yes' }));
    expect(loadSettings().feedback).toBe(true);
  });
  it('a guess that changes quickly is spoken at most once per gap', async () => {
    const { AnnouncerProvider, useAnnounceOnChange } = await import('../src/output/announcer');
    const speech = await import('../src/output/speech');
    const said: string[] = [];
    speech.setSynth({ speak: (t) => said.push(t), cancel: () => {} });
    speech.setSpeechEnabled(true);
    speech.resetSpeechMemory();
    let clock = 10_000;
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    function Probe({ text }: { text: string }) {
      useAnnounceOnChange(text, { minGapMs: 2000 });
      return null;
    }
    const host = document.createElement('div');
    const root = createRoot(host);
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const show = (text: string) =>
      act(() => {
        root.render(createElement(AnnouncerProvider, null, createElement(Probe, { text })));
      });
    show('Looks like "A"');
    clock += 300;
    show('Looks like "B"');
    clock += 300;
    show('Looks like "C"');
    expect(said).toEqual(['Looks like "A"']);
    clock += 2500;
    show('Looks like "D"');
    expect(said).toEqual(['Looks like "A"', 'Looks like "D"']);
    act(() => root.unmount());
    spy.mockRestore();
  });
});
