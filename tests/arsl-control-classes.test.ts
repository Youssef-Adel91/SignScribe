import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createActor, getNextSnapshot } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { describe, expect, it } from 'vitest';
import {
  controlClasses,
  controlKind,
  getAlphabet,
  letterLabels,
  parseAlphabet,
} from '../src/config/alphabet';
import { CONTROLS, LETTERS } from '../src/collect/dataset';
import { LetterController, type LetterUI } from '../src/recognition/letterController';
import { LOG_HEAD, LetterLog, rowOf } from '../src/recognition/letterLog';
import { commandState, dropLettersWithCommand } from '../src/recognition/priority';
import { DEFAULT_TUNING, type LetterTuning } from '../src/recognition/tuning';
import type { LetterGuess, MotionRecognizer, StaticRecognizer } from '../src/recognition/types';
import { TakeRecorder } from '../src/collect/recorder';
import { controlEvent, signScribeMachine, type Ev } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';
import { LM } from '../src/vision/landmarks';
import { makeFrame, makeHand } from '../src/vision/testing/fixtures';
import type { HandObs } from '../src/vision/types';
import { visionStore } from '../src/vision/store';

const arsl = getAlphabet('arsl');
const asl = getAlphabet('asl');
const SIGNING = { cx: 0.25, cy: 0.5 };
const MS = 33;
const T: LetterTuning = {
  ...DEFAULT_TUNING.knn,
  stableMs: 200,
  holdMs: 800,
  controlHoldMs: 300,
  releaseMs: 200,
  cooldownMs: 400,
  commandHoldoffMs: 500,
  stillFrames: 4,
  minMargin: 0.1,
};

describe('1. controls in the ArSL alphabet file: static and dynamic', () => {
  it('has the four controls, space and done static, delete and cancel dynamic', () => {
    expect(controlClasses(arsl)).toEqual([
      { classId: 'ctl_space', action: 'space', kind: 'static' },
      { classId: 'ctl_done', action: 'done', kind: 'static' },
      { classId: 'ctl_delete', action: 'delete', kind: 'dynamic' },
      { classId: 'ctl_cancel', action: 'cancel', kind: 'dynamic' },
    ]);
  });
  it('static controls are in the static list (the letter model), dynamic ones in the dynamic list ($1)', () => {
    for (const c of controlClasses(arsl)) {
      expect(controlKind(arsl, c.classId)).toBe(c.kind);
      expect(c.kind === 'static' ? arsl.static : arsl.dynamic).toContain(c.classId);
      expect(c.kind === 'static' ? arsl.dynamic : arsl.static).not.toContain(c.classId);
    }
    expect(controlKind(arsl, 'ain')).toBeNull();
  });
  it('the controls are not letters: the 32 ArSL21L classes remain the letters', () => {
    expect(letterLabels(arsl)).toHaveLength(32);
    expect(letterLabels(arsl).some((l) => l.startsWith('ctl_'))).toBe(false);
    expect(letterLabels(asl)).toHaveLength(26);
  });
  it('the collection page lists letters only in its letter list, and the controls apart (ASL: none)', () => {
    expect(LETTERS.some((l) => l.startsWith('ctl_'))).toBe(false);
    expect(CONTROLS).toEqual([]); // the active alphabet is ASL here
  });
  it('the file refuses a control class that is not a label, an unknown action, and the same action twice', () => {
    expect(() => parseAlphabet({ static: ['a', 'b'], controls: { zz: 'space' } }, 'c')).toThrow(
      /not a label/,
    );
    expect(() => parseAlphabet({ static: ['a', 'b'], controls: { a: 'jump' } }, 'c')).toThrow(
      /space, delete, cancel, done/,
    );
    expect(() =>
      parseAlphabet({ static: ['a', 'b', 'c'], controls: { a: 'space', b: 'space' } }, 'c'),
    ).toThrow(/two classes/);
  });
  it('the old name "finish" is read as "done"', () => {
    expect(parseAlphabet({ static: ['a', 'b'], controls: { a: 'finish' } }, 'c').controls).toEqual({
      a: 'done',
    });
  });
  it('the assignment is documented in the file as a decision of the team', () => {
    expect(JSON.stringify(arsl.todo)).toContain('ctl_space');
  });
});

describe('a control class acts like the hand gesture of the same name, from any spelling state', () => {
  type Snap = SnapshotFrom<typeof signScribeMachine>;
  const send = (snap: Snap, ...events: Ev[]): Snap =>
    events.reduce((s, e) => getNextSnapshot(signScribeMachine, s, e), snap);
  const spelling = (): Snap => {
    const a = createActor(signScribeMachine, { input: { alphabet: 'arabic' } });
    a.start();
    return send(a.getSnapshot(), ...PATH_TO_SCREEN[6]);
  };
  const L = (letter: string): Ev[] => [
    { type: 'LETTER_CANDIDATE', candidate: { letter, confidence: 0.9, alternatives: [] } },
    { type: 'LETTER_CONFIRMED', letter },
  ];
  it('the four actions map to the four events', () => {
    expect(['space', 'delete', 'cancel', 'done'].map((a) => controlEvent(a as never).type)).toEqual(
      ['SPACE', 'DELETE', 'NO', 'YES'],
    );
  });
  it('space ends the word and delete takes a letter back, with no candidate before', () => {
    let s = send(spelling(), ...L('ain'), ...L('bb'));
    expect(s.context.word).toBe('عب');
    s = send(s, { type: 'LETTER_CONFIRMED', letter: 'ctl_delete' });
    expect(s.context.word).toBe('ع');
    s = send(s, { type: 'LETTER_CONFIRMED', letter: 'ctl_space' });
    expect(s.context.words).toEqual(['ع']);
    expect(s.context.word).toBe('');
  });
  it('done goes to the sentence review and cancel goes back to the method screen', () => {
    const done = send(spelling(), ...L('ain'), { type: 'LETTER_CONFIRMED', letter: 'ctl_done' });
    expect(done.value).toBe('review');
    const cancel = send(spelling(), { type: 'LETTER_CONFIRMED', letter: 'ctl_cancel' });
    expect(cancel.value).toBe('method');
  });
  it('a control is never written as a letter', () => {
    const s = send(
      spelling(),
      { type: 'LETTER_CONFIRMED', letter: 'ctl_space' },
      { type: 'LETTER_CONFIRMED', letter: 'ctl_delete' },
    );
    expect(s.context.word).toBe('');
  });
});

class Fake implements StaticRecognizer {
  id = 'mlp';
  guess: LetterGuess | null = null;
  recognize() {
    return this.guess;
  }
}
const g = (letter: string, confidence = 0.95): LetterGuess => ({
  letter,
  confidence,
  alternatives: [{ letter: 'X', confidence: 0.02 }],
});
class Sim {
  t = 1000;
  log: { t: number; e: Ev }[] = [];
  ui!: LetterUI;
  constructor(public c: LetterController) {}
  run(
    ms: number,
    hands: HandObs[] | ((i: number) => HandObs[]),
    command?: { active: boolean; fired: boolean; label?: string; score?: number },
  ) {
    const end = this.t + ms;
    for (let i = 0; this.t < end; this.t += MS, i++) {
      const r = this.c.step(makeFrame(this.t, typeof hands === 'function' ? hands(i) : hands), {
        screen: 6,
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
}
const still = () => [makeHand('fist', SIGNING)];
const controller = (f: Fake | null, m: MotionRecognizer | null = null) =>
  new LetterController(f, m, T, arsl.controls);

describe('static controls: classified like letters, acting after their own shorter hold', () => {
  it('a held static control is confirmed once, with no candidate and nothing shown as a letter', () => {
    const f = new Fake();
    f.guess = g('ctl_space');
    const s = new Sim(controller(f));
    const ui = s.run(3000, still());
    expect(s.log.map((l) => l.e)).toEqual([{ type: 'LETTER_CONFIRMED', letter: 'ctl_space' }]);
    expect(s.types()).not.toContain('LETTER_CANDIDATE');
    expect(ui.guess).toBeNull();
  });
  it('acts sooner than a letter would (controlHoldMs, not holdMs)', () => {
    const f = new Fake();
    f.guess = g('ctl_space');
    const s = new Sim(controller(f));
    s.run(T.controlHoldMs + MS * 8, still());
    expect(s.types()).toEqual(['LETTER_CONFIRMED']);
    const letter = new Fake();
    letter.guess = g('ain');
    const s2 = new Sim(controller(letter));
    s2.run(T.controlHoldMs + MS * 8, still());
    expect(s2.types()).not.toContain('LETTER_CONFIRMED');
  });
  it('is still gated by stillness, confidence and release', () => {
    const shaking = (i: number) => [
      makeHand('fist', { cx: SIGNING.cx + (i % 2 ? 0.05 : -0.05), cy: SIGNING.cy }),
    ];
    const f = new Fake();
    f.guess = g('ctl_done');
    const moving = new Sim(controller(f));
    moving.run(3000, shaking);
    expect(moving.log).toEqual([]);
    f.guess = g('ctl_done', 0.5);
    const weak = new Sim(controller(f));
    weak.run(3000, still());
    expect(weak.log).toEqual([]);
    f.guess = g('ctl_done');
    const held = new Sim(controller(f));
    held.run(6000, still());
    expect(held.types()).toEqual(['LETTER_CONFIRMED']); // not again until the hand changes
  });
  it('a control seen after a candidate letter clears that candidate', () => {
    const f = new Fake();
    f.guess = g('ain');
    const s = new Sim(controller(f));
    s.run(500, still());
    expect(s.types()).toContain('LETTER_CANDIDATE');
    f.guess = g('ctl_space');
    s.run(600, still());
    expect(s.types()).toContain('CANDIDATE_LOST');
  });
});

class FakeMotion implements MotionRecognizer {
  id = 'fake-motion';
  landmark = LM.INDEX_TIP;
  constructor(
    private readonly letter: string,
    private readonly score = 0.9,
  ) {}
  recognize() {
    return { letter: this.letter, score: this.score };
  }
}
const moving = (progress: number) => {
  const h = makeHand('point', SIGNING);
  h.landmarks[LM.INDEX_TIP] = {
    ...h.landmarks[LM.INDEX_TIP],
    x: 0.2 + 0.25 * progress,
    y: 0.3 + 0.3 * progress,
  };
  return h;
};
const stroke = (s: Sim) => {
  s.run(300, [moving(0)]);
  for (let i = 0; i <= 18; i++) s.run(33, [moving(i / 18)]);
  s.run(600, [moving(1)]);
};

describe('dynamic controls: $1 on the index-fingertip path', () => {
  it('a matched control stroke is confirmed at once, with no candidate', () => {
    const s = new Sim(controller(null, new FakeMotion('ctl_delete')));
    stroke(s);
    expect(s.log.map((l) => l.e)).toEqual([{ type: 'LETTER_CONFIRMED', letter: 'ctl_delete' }]);
    expect(s.ui.debug.source).not.toBe('letter-model');
  });
  it('a letter stroke still gives the candidate and the letter', () => {
    const s = new Sim(controller(null, new FakeMotion('ain')));
    stroke(s);
    expect(s.types()).toEqual(['LETTER_CANDIDATE', 'LETTER_CONFIRMED']);
  });
  it('a stroke under the $1 score is ignored (the score is a setting)', () => {
    const weak = new Sim(controller(null, new FakeMotion('ctl_delete', 0.5)));
    stroke(weak);
    expect(weak.log).toEqual([]);
    const lenient = new Sim(
      new LetterController(
        null,
        new FakeMotion('ctl_delete', 0.5),
        { ...T, motionMinScore: 0.4 },
        arsl.controls,
      ),
    );
    stroke(lenient);
    expect(lenient.types()).toEqual(['LETTER_CONFIRMED']);
  });
});

describe('3. the overlay and the log show who decided every frame, with the score', () => {
  it('rule gesture: the command in progress, with the gesture engine score', () => {
    const f = new Fake();
    f.guess = g('ain');
    const s = new Sim(controller(f));
    const ui = s.run(300, still(), { active: true, fired: false, label: 'fist', score: 0.83 });
    expect(ui.debug).toMatchObject({
      state: 'command',
      source: 'rule-gesture',
      decided: 'fist',
      score: 0.83,
    });
  });
  it('control class: the action and the confidence', () => {
    const f = new Fake();
    f.guess = g('ctl_space', 0.91);
    const s = new Sim(controller(f));
    const ui = s.run(200 + MS * 6, still());
    expect(ui.debug).toMatchObject({ source: 'control-class', decided: 'space', score: 0.91 });
  });
  it('letter model: the letter and the confidence, also when it is rejected', () => {
    const f = new Fake();
    f.guess = g('ain', 0.97);
    const s = new Sim(controller(f));
    expect(s.run(400, still()).debug).toMatchObject({
      source: 'letter-model',
      decided: 'ain',
      score: 0.97,
    });
    f.guess = g('none', 0.99);
    const r = new Sim(controller(f)).run(400, still());
    expect(r.debug).toMatchObject({
      source: 'letter-model',
      decided: 'none',
      rejectedBecause: 'none',
    });
  });
  it('$1 template: while the stroke is drawn, and the score when it matched', () => {
    const s = new Sim(controller(null, new FakeMotion('ctl_cancel', 0.77)));
    s.run(300, [moving(0)]);
    let sawTracing = false;
    for (let i = 0; i <= 18; i++) {
      const ui = s.run(33, [moving(i / 18)]);
      if (ui.debug.state === 'tracing-motion') {
        sawTracing = true;
        expect(ui.debug.source).toBe('$1-template');
      }
    }
    let matched: LetterUI | null = null;
    for (let i = 0; i < 30; i++) {
      const ui = s.run(33, [moving(1)]);
      if (ui.debug.state === 'motion-matched') matched = ui;
    }
    expect(sawTracing).toBe(true);
    expect(matched!.debug).toMatchObject({ source: '$1-template', decided: 'cancel', score: 0.77 });
  });
  it('when nobody decided (hand moving, no hand) the source is "none"', () => {
    const s = new Sim(controller(new Fake()));
    expect(s.run(200, []).debug.source).toBe('none');
  });
  it('commandState passes the gesture and its score on', () => {
    const ui = {
      hands: 1,
      handViews: [
        { side: 'left' as const, gesture: 'fist' as const, confidence: 0.82, inZone: true },
      ],
      pointer: null,
      dwell: { id: null, progress: 0, ms: 800 },
      wake: 0,
      help: 0,
      command: { label: 'fist' as const, progress: 0.4 },
      handLost: false,
    };
    expect(commandState(ui, [], 'right', 1000)).toMatchObject({
      active: true,
      label: 'fist',
      score: 0.82,
    });
  });
  it('the log has the columns decided_by, decided and score, one value per frame', () => {
    expect(LOG_HEAD.slice(2, 6)).toEqual(['state', 'decided_by', 'decided', 'score']);
    const log = new LetterLog();
    const ui: LetterUI = {
      guess: null,
      raw: [],
      progress: 0,
      tracingMotion: false,
      debug: {
        state: 'command',
        source: 'rule-gesture',
        decided: 'fist',
        score: 0.83,
        speed: 0,
        stillCount: 0,
        stillFrames: 4,
        stableMs: 0,
        cooldownLeftMs: 0,
        commandLeftMs: 0,
        rejectedBecause: '',
      },
    };
    log.record(rowOf(10, 6, ui, { active: true, fired: false, label: 'fist' }, [], 'arsl/mlp'));
    const [head, row] = log.toCsv().trim().split('\n');
    const cols = head.split(',');
    const cells = row.split(',');
    expect(cells[cols.indexOf('decided_by')]).toBe('rule-gesture');
    expect(cells[cols.indexOf('decided')]).toBe('fist');
    expect(cells[cols.indexOf('score')]).toBe('0.830');
  });
  it('the overlay prints it in words', async () => {
    const { LetterDebug } = await import('../src/dev/LetterDebug');
    const ui = (source: LetterUI['debug']['source'], decided: string, score: number): LetterUI => ({
      guess: null,
      raw: [],
      progress: 0,
      tracingMotion: false,
      debug: {
        state: 'committed',
        source,
        decided,
        score,
        speed: 0,
        stillCount: 5,
        stillFrames: 5,
        stableMs: 0,
        cooldownLeftMs: 0,
        commandLeftMs: 0,
        rejectedBecause: '',
      },
    });
    for (const [src, word] of [
      ['rule-gesture', 'old rule gesture'],
      ['control-class', 'control class'],
      ['$1-template', '$1 template'],
      ['letter-model', 'letter model'],
    ] as const) {
      visionStore.set({
        letters: { ...visionStore.state.letters, status: 'ready', ui: ui(src, 'x', 0.66) },
      });
      const html = renderToStaticMarkup(createElement(LetterDebug));
      expect(html).toContain(word);
      expect(html).toContain('score 0.66');
    }
    visionStore.reset();
  });
});

describe('4. a control wins over a letter in the same frame (priority kept)', () => {
  it('no control class and no letter is acted on while a rule gesture is active', () => {
    for (const guess of ['ctl_space', 'ain']) {
      const f = new Fake();
      f.guess = g(guess);
      const s = new Sim(controller(f));
      s.run(3000, still(), { active: true, fired: false, label: 'fist', score: 0.9 });
      expect(s.log).toEqual([]);
    }
  });
  it('a frame that fires a rule command removes the model events of that frame', () => {
    const cmd: Ev[] = [{ type: 'DELETE' }];
    const model: Ev[] = [
      { type: 'LETTER_CONFIRMED', letter: 'ctl_space' },
      { type: 'LETTER_CONFIRMED', letter: 'ain' },
    ];
    expect(dropLettersWithCommand(cmd, model)).toEqual([]);
  });
  it('the old rule gestures are unchanged: their hold times are exactly what they were', async () => {
    const { HOLD } = await import('../src/vision/controller');
    // changing one of these needs the debug log to show why it misses (docs/KNOWN_ISSUES.md #12), then a test and a new line here
    expect(HOLD).toEqual({ wake: 2000, help: 1000, open: 500, fist: 500, up: 600, down: 600 });
  });
});

describe('2. recording control takes keeps the person id', () => {
  it('a control take carries person = the signer code, and its kind', () => {
    const rec = (label: string, kind: 'static' | 'dynamic') => {
      const r = new TakeRecorder();
      r.start(label, { signer: 's07', session: 'desk', hand: 'right' }, 0, kind, 0);
      let t = 0;
      let st = r.state;
      while (st.kind !== 'done' && st.kind !== 'failed' && t < 12_000) {
        t += 40;
        const h = makeHand('point', { cx: 0.5, cy: 0.5 });
        h.landmarks[LM.INDEX_TIP] = {
          ...h.landmarks[LM.INDEX_TIP],
          x: 0.4 + 0.2 * ((t / 2200) % 1),
          y: 0.4,
        };
        st = r.feed(makeFrame(t, [h]));
      }
      return st;
    };
    const s = rec('ctl_space', 'static');
    expect(s.kind).toBe('done');
    if (s.kind === 'done')
      expect(s.take).toMatchObject({
        label: 'ctl_space',
        kind: 'static',
        person: 's07',
        signer: 's07',
      });
    const d = rec('ctl_delete', 'dynamic');
    expect(d.kind).toBe('done');
    if (d.kind === 'done')
      expect(d.take).toMatchObject({ label: 'ctl_delete', kind: 'dynamic', person: 's07' });
  });
  it('the collection page has a Controls section that is shown only for an alphabet that has controls', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/collect/CollectPanel.tsx', 'utf8');
    expect(src).toContain('data-testid="control-takes"');
    expect(src).toContain('CONTROLS.length > 0');
  });
});

describe('the $1 model of an alphabet (dynamic controls)', () => {
  const dollar = (labels: string[]) => ({
    format: 'signscribe-model',
    version: 1,
    type: 'dollarP',
    landmark: 8,
    n: 32,
    templates: labels.map((label) => ({
      label,
      points: Array.from({ length: 12 }, (_, i) => [i * 10, i * 4] as [number, number]),
    })),
    meta: { synthetic: false },
  });
  const serve = (files: Record<string, unknown>) =>
    (async (url: string) => {
      const hit = Object.entries(files).find(([name]) => url.endsWith(name));
      return hit
        ? new Response(JSON.stringify(hit[1]), { headers: { 'content-type': 'application/json' } })
        : new Response('', { status: 404 });
    }) as typeof fetch;
  it('ArSL reads motion-arsl-dollar.json; ASL keeps motion-dollar.json', async () => {
    const { motionModelUrl } = await import('../src/recognition/models');
    expect(motionModelUrl('asl')).toMatch(/models\/motion-dollar\.json$/);
    expect(motionModelUrl('arsl')).toMatch(/models\/motion-arsl-dollar\.json$/);
  });
  it('is accepted with the dynamic controls as templates', async () => {
    const { loadModels } = await import('../src/recognition/models');
    const m = await loadModels(
      serve({ 'motion-arsl-dollar.json': dollar(['ctl_delete', 'ctl_cancel']) }),
      'arsl',
    );
    expect(m.motion.status).toBe('ready');
  });
  it('is refused when a template has a label the alphabet does not have', async () => {
    const { loadModels } = await import('../src/recognition/models');
    const m = await loadModels(serve({ 'motion-arsl-dollar.json': dollar(['J', 'Z']) }), 'arsl');
    expect(m.motion.status).toBe('error');
    expect(m.motion.message).toMatch(/another alphabet/);
  });
  it('the ASL J / Z model is not read for ArSL', async () => {
    const { loadModels } = await import('../src/recognition/models');
    const m = await loadModels(serve({ 'motion-dollar.json': dollar(['J', 'Z']) }), 'arsl');
    expect(m.motion.status).toBe('missing');
  });
});
