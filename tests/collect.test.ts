import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LETTERS,
  TakeError,
  coverage,
  defaultKind,
  fromJsonl,
  toJsonl,
  validateTake,
} from '../src/collect/dataset';
import { RECORD, TakeRecorder, frameProblem } from '../src/collect/recorder';
import { MemoryStore } from '../src/collect/store';
import { makeFrame, makeHand } from '../src/vision/testing/fixtures';
import type { HandFrame, HandObs } from '../src/vision/types';

const golden = readFileSync('ml/tests/golden_takes.jsonl', 'utf8');
const sitting = { signer: 's01', session: 'lamp-60cm', hand: 'right' as const };

describe('dataset format', () => {
  it('reads the file the Python tools also read', () => {
    const takes = fromJsonl(golden);
    expect(takes.map((t) => t.kind)).toEqual(['static', 'dynamic']);
    expect(takes[0].frames[0].lm).toHaveLength(21);
  });
  it('writes lines that read back to the same takes', () => {
    const takes = fromJsonl(golden);
    expect(fromJsonl(toJsonl(takes))).toEqual(
      takes.map((t) => ({
        ...t,
        frames: t.frames.map((f) => ({
          t: Math.round(f.t),
          lm: f.lm.map((p) => p.map((v) => Math.round(v * 1e5) / 1e5)),
        })),
      })),
    );
  });
  const first = () => JSON.parse(golden.split('\n')[0]);
  const bad: [string, (t: Record<string, unknown>) => void, RegExp][] = [
    ['no label', (t) => delete t.label, /missing field 'label'/],
    ['two letters', (t) => (t.label = 'AB'), /one letter/],
    ['version', (t) => (t.v = 2), /version/],
    ['no frames', (t) => (t.frames = []), /at least one frame/],
    [
      '20 landmarks',
      (t) =>
        ((t.frames as { lm: unknown[] }[])[0].lm = (t.frames as { lm: unknown[] }[])[0].lm.slice(
          0,
          20,
        )),
      /21 landmarks/,
    ],
    ['bad hand', (t) => (t.hand = 'both'), /hand/],
    ['bad kind', (t) => (t.kind = 'x'), /kind/],
  ];
  it.each(bad)('rejects: %s', (_n, mutate, re) => {
    const t = first();
    mutate(t);
    expect(() => validateTake(t)).toThrow(TakeError);
    expect(() => validateTake(t)).toThrow(re);
  });
  it('rejects duplicate ids and bad JSON with the line number', () => {
    const l = golden.split('\n')[0];
    expect(() => fromJsonl(`${l}\n${l}`)).toThrow(/line 2.*same id/);
    expect(() => fromJsonl('{nope')).toThrow(/line 1.*not valid JSON/);
  });
  it('J and Z are recorded as moving signs by default, the rest as static', () => {
    expect(LETTERS.filter((l) => defaultKind(l) === 'dynamic')).toEqual(['J', 'Z']);
  });
  it('coverage counts takes and frames per letter and says nothing else', () => {
    const c = coverage(fromJsonl(golden));
    expect(c.find((x) => x.label === 'B')).toEqual({ label: 'B', takes: 1, frames: 3 });
    expect(c).toHaveLength(26);
  });
});

/** feed a hand for `ms` at 30 fps */
function drive(
  r: TakeRecorder,
  t0: number,
  ms: number,
  hands: () => HandObs[],
  size = { w: 1280, h: 720 },
) {
  let t = t0;
  for (; t < t0 + ms; t += 33) r.feed(makeFrame(t, hands(), size.w, size.h));
  return t;
}
const good = () => [makeHand('fist', { size: 0.2, cx: 0.5, cy: 0.5 })];

describe('TakeRecorder', () => {
  it('counts down 3, 2, 1, then records, then returns a valid take', () => {
    const r = new TakeRecorder();
    r.start('B', sitting, 0);
    expect(r.state).toMatchObject({ kind: 'countdown', secondsLeft: 3 });
    r.feed(makeFrame(1100, good()));
    expect(r.state).toMatchObject({ kind: 'countdown', secondsLeft: 2 });
    drive(r, 1100, RECORD.countdownMs - 1100 + 100, good);
    expect(r.state.kind).toBe('recording');
    drive(r, 3200, RECORD.staticMs + 200, good);
    expect(r.state.kind).toBe('done');
    if (r.state.kind !== 'done') return;
    const take = validateTake(JSON.parse(JSON.stringify(r.state.take)));
    expect(take).toMatchObject({
      label: 'B',
      kind: 'static',
      signer: 's01',
      session: 'lamp-60cm',
      hand: 'right',
      width: 1280,
      height: 720,
    });
    expect(take.frames.length).toBeGreaterThanOrEqual(RECORD.staticMinFrames);
    // frames are spaced out, not one per camera frame
    expect(take.frames.length).toBeLessThan(RECORD.staticMs / RECORD.staticEveryMs + 2);
  });
  it('J is recorded as a moving take with every frame', () => {
    const r = new TakeRecorder();
    r.start('J', sitting, 0);
    drive(r, 0, RECORD.countdownMs + 100, good);
    drive(r, 3100, RECORD.dynamicMs + 200, good);
    expect(r.state.kind).toBe('done');
    if (r.state.kind === 'done') {
      expect(r.state.take.kind).toBe('dynamic');
      expect(r.state.take.frames.length).toBeGreaterThanOrEqual(RECORD.dynamicMinFrames);
    }
  });
  it.each([
    ['no hand at all', () => [] as HandObs[], /no hand/],
    [
      'hand cut off by the edge',
      () => [makeHand('fist', { size: 0.2, cx: 0.97, cy: 0.5 })],
      /outside the picture/,
    ],
    ['hand too far', () => [makeHand('fist', { size: 0.05, cx: 0.5, cy: 0.5 })], /too far/],
    [
      'hand too close',
      () => [makeHand('fist', { size: 0.5, cx: 0.5, cy: 0.5 })],
      /(too close|outside)/,
    ],
  ])('refuses to save: %s', (_n, hands, why) => {
    const r = new TakeRecorder();
    r.start('B', sitting, 0);
    drive(r, 0, RECORD.countdownMs + 100, hands);
    drive(r, 3100, RECORD.staticMs + 200, hands);
    expect(r.state.kind).toBe('failed');
    if (r.state.kind === 'failed') expect(r.state.reason).toMatch(why);
  });
  it('a short dropout is fine, a long one is not', () => {
    const run = (dropMs: number) => {
      const r = new TakeRecorder();
      r.start('B', sitting, 0);
      drive(r, 0, RECORD.countdownMs + 100, good);
      let t = 3100;
      t = drive(r, t, 600, good);
      t = drive(r, t, dropMs, () => []);
      drive(r, t, RECORD.staticMs, good);
      return r.state.kind;
    };
    expect(run(100)).toBe('done');
    expect(run(900)).toBe('failed');
  });
  it('cancel returns to idle', () => {
    const r = new TakeRecorder();
    r.start('B', sitting, 0);
    r.cancel();
    expect(r.state.kind).toBe('idle');
  });
  it('frameProblem has a reason for every bad case and null for a good frame', () => {
    const f: HandFrame = makeFrame(0, good());
    expect(frameProblem(f.hands[0], f)).toBeNull();
    expect(frameProblem(undefined, f)).toMatch(/no hand/);
    expect(frameProblem({ ...f.hands[0], score: 0.2 }, f)).toMatch(/not clearly/);
  });
});

describe('MemoryStore', () => {
  it('adds, removes and clears', async () => {
    const s = new MemoryStore();
    const [a, b] = fromJsonl(golden);
    await s.add(a);
    await s.add(b);
    expect(await s.all()).toHaveLength(2);
    await s.remove(a.id);
    expect((await s.all()).map((t) => t.id)).toEqual([b.id]);
    await s.clear();
    expect(await s.all()).toEqual([]);
  });
});
