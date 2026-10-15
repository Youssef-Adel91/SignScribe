import { describe, expect, it } from 'vitest';
import { AdaptiveDwell, DwellEngine, MIN_HIT, type Target } from '../src/vision/dwell';

const T1: Target = { id: 'a', rect: { x: 100, y: 100, w: 200, h: 120 }, event: { type: 'YES' } };
const T2: Target = { id: 'b', rect: { x: 500, y: 100, w: 200, h: 120 }, event: { type: 'NO' } };
const on = (t: Target) => ({ x: t.rect.x + t.rect.w / 2, y: t.rect.y + t.rect.h / 2 });

/** runs the engine at 30 fps; returns the first fired target and the progress samples */
function run(e: DwellEngine, p: { x: number; y: number } | null, targets: Target[], from: number, ms: number) {
  const progress: number[] = [];
  let fired: Target | null = null;
  let t = from;
  for (; t <= from + ms; t += 33) {
    const s = e.update(p, targets, t);
    progress.push(s.progress);
    if (s.fired && !fired) fired = s.fired;
  }
  return { fired, progress, t };
}

describe('DwellEngine', () => {
  it('fires after the dwell time and not before', () => {
    const e = new DwellEngine();
    const early = run(e, on(T1), [T1, T2], 0, 700);
    expect(early.fired).toBeNull();
    const done = run(e, on(T1), [T1, T2], early.t, 300);
    expect(done.fired?.id).toBe('a');
  });
  it('progress rises steadily from 0 towards 1', () => {
    const e = new DwellEngine();
    const r = run(e, on(T1), [T1], 0, 700);
    for (let i = 1; i < r.progress.length; i++) expect(r.progress[i]).toBeGreaterThanOrEqual(r.progress[i - 1]);
    expect(r.progress[0]).toBe(0);
    expect(r.progress[r.progress.length - 1]).toBeGreaterThan(0.8);
  });
  it('does not fire again while the pointer stays on the same target', () => {
    const e = new DwellEngine();
    let fires = 0;
    for (let t = 0; t < 4000; t += 33) if (e.update(on(T1), [T1], t).fired) fires++;
    expect(fires).toBe(1);
  });
  it('fires again after the pointer left and came back', () => {
    const e = new DwellEngine();
    let fires = 0;
    let t = 0;
    for (const p of [on(T1), { x: 900, y: 600 }, on(T1)]) {
      const end = t + 1500;
      for (; t < end; t += 33) if (e.update(p, [T1], t).fired) fires++;
    }
    expect(fires).toBe(2);
  });
  it('a pointer that leaves before the end cancels the hold', () => {
    const e = new DwellEngine();
    const a = run(e, on(T1), [T1], 0, 500);
    const b = run(e, { x: 900, y: 600 }, [T1], a.t, 600);
    const c = run(e, on(T1), [T1], b.t, 500); // starts again from zero
    expect(a.fired).toBeNull();
    expect(c.fired).toBeNull();
  });
  it('survives a short flicker of the pointer without losing progress', () => {
    const e = new DwellEngine();
    const a = run(e, on(T1), [T1], 0, 400);
    const b = run(e, null, [T1], a.t, 100); // 100 ms with no pointer
    const c = run(e, on(T1), [T1], b.t, 500);
    expect(c.fired?.id).toBe('a');
  });
  it('picks the nearest of two overlapping targets', () => {
    const near: Target = { id: 'n', rect: { x: 180, y: 100, w: 200, h: 120 }, event: { type: 'YES' } };
    const e = new DwellEngine();
    const r = run(e, { x: 330, y: 160 }, [T1, near], 0, 1000);
    expect(r.fired?.id).toBe('n');
  });
  it('small targets get a hit area of at least MIN_HIT px', () => {
    const tiny: Target = { id: 't', rect: { x: 300, y: 300, w: 40, h: 40 }, event: { type: 'YES' } };
    const e = new DwellEngine();
    const r = run(e, { x: 320 + MIN_HIT / 2 - 4, y: 320 }, [tiny], 0, 1000);
    expect(r.fired?.id).toBe('t');
    const e2 = new DwellEngine();
    const r2 = run(e2, { x: 320 + MIN_HIT, y: 320 }, [tiny], 0, 1000);
    expect(r2.fired).toBeNull();
  });
  it('two targets can be chosen one after the other', () => {
    const e = new DwellEngine();
    const a = run(e, on(T1), [T1, T2], 0, 1000);
    const b = run(e, on(T2), [T1, T2], a.t, 1000);
    expect([a.fired?.id, b.fired?.id]).toEqual(['a', 'b']);
  });
});

describe('AdaptiveDwell', () => {
  it('starts at 0.8 s and gets quicker after three successes in a row', () => {
    const a = new AdaptiveDwell();
    expect(a.ms).toBe(800);
    a.success();
    a.success();
    expect(a.ms).toBe(800);
    a.success();
    expect(a.ms).toBe(750);
  });
  it('never goes below its minimum or above its maximum', () => {
    const a = new AdaptiveDwell();
    for (let i = 0; i < 100; i++) a.success();
    expect(a.ms).toBe(a.min);
    for (let i = 0; i < 100; i++) a.nearMiss();
    expect(a.ms).toBe(a.max);
  });
  it('slows down after a near miss (held more than half way, then left)', () => {
    const e = new DwellEngine();
    const a = run(e, on(T1), [T1], 0, 600);
    run(e, { x: 900, y: 600 }, [T1], a.t, 600);
    run(e, on(T1), [T1], a.t + 600, 100); // new hold begins: the old one is accounted
    expect(e.adaptive.ms).toBe(900);
  });
});
