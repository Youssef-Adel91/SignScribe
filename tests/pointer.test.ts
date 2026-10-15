import { describe, expect, it } from 'vitest';
import { OneEuro, PointerFilter, cameraToScreen } from '../src/vision/pointer';

/** deterministic noise */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296 - 0.5;
};
const std = (v: number[]) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
};

describe('OneEuro', () => {
  it('first sample passes through', () => {
    expect(new OneEuro().filter(123, 0)).toBe(123);
  });
  it('removes most of the jitter of a still finger', () => {
    const f = new OneEuro(1, 0.01);
    const r = rng(7);
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = 500 + 8 * r(); // +-4 px of tracking noise
      raw.push(x);
      out.push(f.filter(x, i * 33));
    }
    expect(std(out.slice(30))).toBeLessThan(std(raw.slice(30)) * 0.4);
  });
  it('follows a fast move with little lag', () => {
    const f = new OneEuro(1, 0.01);
    let last = 0;
    for (let i = 0; i < 60; i++) last = f.filter(i * 20, i * 33); // 600 px/s
    expect(Math.abs(last - 59 * 20)).toBeLessThan(120);
  });
  it('catches up after the finger stops', () => {
    const f = new OneEuro(1, 0.01);
    for (let i = 0; i < 30; i++) f.filter(i * 30, i * 33);
    let last = 0;
    for (let i = 30; i < 130; i++) last = f.filter(900, i * 33);
    expect(Math.abs(last - 900)).toBeLessThan(2);
  });
  it('reset forgets the past', () => {
    const f = new OneEuro();
    f.filter(0, 0);
    f.filter(10, 33);
    f.reset();
    expect(f.filter(999, 66)).toBe(999);
  });
});

describe('PointerFilter', () => {
  it('filters x and y independently', () => {
    const f = new PointerFilter();
    expect(f.filter({ x: 10, y: 20 }, 0)).toEqual({ x: 10, y: 20 });
    const p = f.filter({ x: 10, y: 400 }, 33);
    expect(p.x).toBeCloseTo(10, 5);
    expect(p.y).toBeGreaterThan(20);
  });
});

describe('cameraToScreen', () => {
  it('mirrors x: a hand on the right of the person is on the right of the screen', () => {
    // un-mirrored camera x = 0.2 is the person's right side seen from the camera, i.e. right of a mirror
    const a = cameraToScreen({ x: 0.2, y: 0.5 }, 1000, 800);
    const b = cameraToScreen({ x: 0.8, y: 0.5 }, 1000, 800);
    expect(a.x).toBeGreaterThan(b.x);
  });
  it('centre maps to the centre', () => {
    const c = cameraToScreen({ x: 0.5, y: 0.5 }, 1000, 800);
    expect(c.x).toBeCloseTo(500, 5);
    expect(c.y).toBeCloseTo(400, 5);
  });
  it('the whole screen can be reached inside the camera view (margins clamp)', () => {
    const tl = cameraToScreen({ x: 0.88, y: 0.12 }, 1000, 800);
    const br = cameraToScreen({ x: 0.12, y: 0.88 }, 1000, 800);
    expect(tl).toEqual({ x: 0, y: 0 });
    expect(br.x).toBeCloseTo(1000, 5);
    expect(br.y).toBeCloseTo(800, 5);
    const out = cameraToScreen({ x: -0.5, y: 2 }, 1000, 800);
    expect(out.x).toBeLessThanOrEqual(1000);
    expect(out.y).toBeLessThanOrEqual(800);
  });
});
