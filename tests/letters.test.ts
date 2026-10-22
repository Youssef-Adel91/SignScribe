import { describe, expect, it } from 'vitest';
import { LETTER, LetterController } from '../src/recognition/letterController';
import type { LetterGuess, MotionRecognizer, StaticRecognizer } from '../src/recognition/types';
import type { Ev } from '../src/state/machine';
import { LM } from '../src/vision/landmarks';
import { makeFrame, makeHand } from '../src/vision/testing/fixtures';
import type { HandObs } from '../src/vision/types';

/** a recognizer whose answer the test sets */
class Fake implements StaticRecognizer {
  id = 'fake';
  guess: LetterGuess | null = null;
  recognize() {
    return this.guess;
  }
}
const g = (letter: string, confidence = 0.9): LetterGuess => ({
  letter,
  confidence,
  alternatives: [{ letter: 'X', confidence: 0.05 }],
});

const SIGNING = { cx: 0.25, cy: 0.5 }; // right-handed signer: signing side (mirrored right)
const ZONE = { cx: 0.8, cy: 0.5 }; // command zone (mirrored left)

class Sim {
  t = 1000;
  log: { t: number; e: Ev }[] = [];
  constructor(
    public c: LetterController,
    public screen = 6,
  ) {}
  run(ms: number, hands: HandObs[], screen = this.screen) {
    const end = this.t + ms;
    let ui;
    for (; this.t < end; this.t += 33) {
      const r = this.c.step(makeFrame(this.t, hands), { screen, signingHand: 'right' });
      ui = r.ui;
      for (const e of r.events) this.log.push({ t: this.t, e });
    }
    return ui;
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
const sign = (o = SIGNING) => [makeHand('fist', o)];

describe('LetterController (static letters)', () => {
  it('writes nothing without a model', () => {
    const s = new Sim(new LetterController(null));
    s.run(3000, sign());
    expect(s.log).toEqual([]);
  });
  it('shows a candidate after the guess is stable, then writes it after the hold', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f));
    s.run(LETTER.stableMs - 60, sign());
    expect(s.types()).toEqual([]);
    s.run(200, sign());
    expect(s.types()).toContain('LETTER_CANDIDATE');
    expect(s.letters()).toEqual([]);
    s.run(LETTER.holdMs, sign());
    expect(s.letters()).toEqual(['B']);
  });
  it('a weak guess is ignored, and a guess that is shown but weak is not written', () => {
    const f = new Fake();
    f.guess = g('B', LETTER.minConfidence - 0.05);
    const s = new Sim(new LetterController(f));
    s.run(3000, sign());
    expect(s.log).toEqual([]);
    f.guess = g('B', (LETTER.minConfidence + LETTER.confirmConfidence) / 2);
    s.run(3000, sign());
    expect(s.types()).toContain('LETTER_CANDIDATE');
    expect(s.letters()).toEqual([]);
  });
  it('a letter that keeps changing never reaches the hold', () => {
    const f = new Fake();
    const s = new Sim(new LetterController(f));
    for (let i = 0; i < 12; i++) {
      f.guess = g(i % 2 ? 'A' : 'B');
      s.run(300, sign());
    }
    expect(s.letters()).toEqual([]);
  });
  it('the same sign is not written twice in a row; it needs a release first', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f));
    s.run(2500, sign());
    expect(s.letters()).toEqual(['B']);
    s.run(1500, [makeHand('open', { ...SIGNING })]); // still the same guess: no repeat
    expect(s.letters()).toEqual(['B']);
    f.guess = null; // hand relaxes
    s.run(LETTER.releaseMs + 100, sign());
    f.guess = g('B');
    s.run(2500, sign());
    expect(s.letters()).toEqual(['B', 'B']);
  });
  it('a different letter can follow at once after the release time', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f));
    s.run(2500, sign());
    f.guess = g('C');
    s.run(2500, sign());
    expect(s.letters()).toEqual(['B', 'C']);
  });
  it('losing the hand while a candidate is shown sends CANDIDATE_LOST', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f));
    s.run(500, sign());
    s.run(200, []);
    expect(s.types()).toContain('CANDIDATE_LOST');
  });
  it('the hand in the command zone is never read as a letter', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f));
    s.run(3000, [makeHand('fist', ZONE)]);
    expect(s.log).toEqual([]);
  });
  it('with a hand in each place only the signing hand counts', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f));
    s.run(2500, [makeHand('thumbsUp', ZONE), makeHand('fist', SIGNING)]);
    expect(s.letters()).toEqual(['B']);
  });
  it('does nothing on other screens', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f));
    for (const screen of [1, 3, 5, 9, 10, 11, 12]) s.run(1500, sign(), screen);
    expect(s.log).toEqual([]);
  });
  it('a command given while a letter is held blocks that letter until it is released', () => {
    const f = new Fake();
    f.guess = g('B');
    const c = new LetterController(f);
    const s = new Sim(c);
    s.run(500, sign()); // candidate shown
    c.notifyCommand(); // e.g. thumbs down = cancel
    s.run(2500, sign());
    expect(s.letters()).toEqual([]);
    f.guess = null;
    s.run(LETTER.releaseMs + 100, sign());
    f.guess = g('B');
    s.run(2500, sign());
    expect(s.letters()).toEqual(['B']);
  });
  it('refreshes the shown guess a few times a second, not every frame', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f));
    s.run(LETTER.holdMs - 100, sign());
    const n = s.types().filter((x) => x === 'LETTER_CANDIDATE').length;
    expect(n).toBeGreaterThan(1);
    expect(n).toBeLessThan(10);
  });
  it('resets when the screen changes', () => {
    const f = new Fake();
    f.guess = g('B');
    const c = new LetterController(f);
    const s = new Sim(c);
    s.run(500, sign(), 6);
    s.run(100, sign(), 5);
    expect(s.log.filter((l) => l.e.type === 'LETTER_CONFIRMED')).toEqual([]);
  });
});

/** a motion recogniser that says "J" for any path and remembers it */
class FakeMotion implements MotionRecognizer {
  id = 'fake-motion';
  landmark = LM.INDEX_TIP;
  last: { x: number; y: number }[] = [];
  score = 0.9;
  recognize(path: { x: number; y: number }[]) {
    this.last = path;
    return this.score > 0 ? { letter: 'J', score: this.score } : null;
  }
}
/** a hand whose index tip travels along a line while the rest stays put */
const moving = (progress: number, o = SIGNING) => {
  const h = makeHand('point', o);
  h.landmarks[LM.INDEX_TIP] = {
    ...h.landmarks[LM.INDEX_TIP],
    x: 0.2 + 0.25 * progress,
    y: 0.3 + 0.3 * progress,
  };
  return h;
};

describe('LetterController (moving signs)', () => {
  const swipe = (s: Sim, ms = 600) => {
    const steps = Math.ceil(ms / 33);
    for (let i = 0; i <= steps; i++) s.run(33, [moving(i / steps)]);
  };
  it('recognises a drawn path once it stops, writes the letter, and hands $P the path', () => {
    const m = new FakeMotion();
    const s = new Sim(new LetterController(null, m));
    s.run(300, [moving(0)]);
    swipe(s);
    s.run(600, [moving(1)]);
    expect(s.letters()).toEqual(['J']);
    expect(m.last.length).toBeGreaterThan(5);
  });
  it('a hand that only trembles is not a motion', () => {
    const m = new FakeMotion();
    const s = new Sim(new LetterController(null, m));
    for (let i = 0; i < 60; i++) s.run(33, [moving(0.5 + (i % 2) * 0.004)]);
    expect(s.log).toEqual([]);
  });
  it('a path the model does not know writes nothing', () => {
    const m = new FakeMotion();
    m.score = 0;
    const s = new Sim(new LetterController(null, m));
    swipe(s);
    s.run(800, [moving(1)]);
    expect(s.log).toEqual([]);
  });
  it('a weak $P score writes nothing', () => {
    const m = new FakeMotion();
    m.score = LETTER.motionMinScore - 0.1;
    const s = new Sim(new LetterController(null, m));
    swipe(s);
    s.run(800, [moving(1)]);
    expect(s.letters()).toEqual([]);
  });
  it('while the motion is being drawn the static guess is held back', () => {
    const f = new Fake();
    f.guess = g('B');
    const s = new Sim(new LetterController(f, new FakeMotion()));
    swipe(s, 400);
    expect(s.letters()).toEqual([]);
  });
});
