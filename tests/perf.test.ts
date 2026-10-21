import { describe, expect, it } from 'vitest';
import { dist, percentile, provenance, summarize, type Sample } from '../src/perf/summary';

const at = (times: number[], infer = 10, step = 1): Sample[] =>
  times.map((t) => ({ t, inferMs: infer, stepMs: step }));
const steady = (fps: number, seconds: number): Sample[] =>
  at(Array.from({ length: fps * seconds + 1 }, (_, i) => (i * 1000) / fps));

describe('percentile and dist', () => {
  it('nearest rank', () => {
    const v = [5, 1, 4, 2, 3];
    expect(percentile(v, 50)).toBe(3);
    expect(percentile(v, 100)).toBe(5);
    expect(percentile(v, 0)).toBe(1);
    expect(percentile([], 50)).toBeNaN();
  });
  it('dist has min, mean and max', () => {
    expect(dist([1, 2, 3, 10])).toMatchObject({ min: 1, max: 10, mean: 4 });
    expect(dist([])).toBeNull();
  });
});

describe('summarize', () => {
  it('a steady 30 fps recording gives 30 fps and no stalls', () => {
    const s = summarize(steady(30, 10), [], 'camera', 300);
    expect(s.fpsMean).toBeCloseTo(30, 5);
    expect(s.fpsWorstSecond).toBeGreaterThanOrEqual(29);
    expect(s.stalls).toBe(0);
    expect(s.frameIntervalMs?.p95).toBeCloseTo(33.33, 1);
    expect(s.handShare).toBeCloseTo(300 / 301, 5);
  });
  it('counts stalls and shows them in the worst second and the longest gap', () => {
    const t = [
      ...Array.from({ length: 31 }, (_, i) => i * 33),
      1500,
      1533,
      ...Array.from({ length: 30 }, (_, i) => 1566 + i * 33),
    ];
    const s = summarize(at(t), [], 'camera');
    expect(s.stalls).toBe(1);
    expect(s.frameIntervalMs?.max).toBeGreaterThan(400);
    expect(s.fpsWorstSecond).toBeLessThan(25);
  });
  it('reports model and own-code time separately', () => {
    const s = summarize(at([0, 33, 66, 99], 20, 2), [], 'camera');
    expect(s.inferMs?.p50).toBe(20);
    expect(s.stepMs?.p50).toBe(2);
  });
  it('sums long tasks', () => {
    expect(summarize(steady(30, 2), [60, 120], 'camera').longTasks).toEqual({
      count: 2,
      totalMs: 180,
      maxMs: 120,
    });
  });
  it('copes with zero and one frame', () => {
    expect(summarize([], [], 'camera')).toMatchObject({
      frames: 0,
      fpsMean: 0,
      frameIntervalMs: null,
      handShare: null,
    });
    expect(summarize(at([5]), [], 'camera')).toMatchObject({ frames: 1, fpsMean: 0, stalls: 0 });
  });
});

describe('provenance', () => {
  it('a mock recording can never pass for a camera measurement', () => {
    expect(provenance(summarize(steady(30, 10), [], 'mock'))).toMatch(/NOT a camera/);
  });
  it('a short camera recording is flagged', () =>
    expect(provenance(summarize(steady(30, 1), [], 'camera'))).toMatch(/Too few/));
  it('a long camera recording is marked as measured', () =>
    expect(provenance(summarize(steady(30, 10), [], 'camera'))).toMatch(/real camera/));
});
