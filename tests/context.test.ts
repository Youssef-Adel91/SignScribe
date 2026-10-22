import { describe, expect, it } from 'vitest';
import { BAD_AFTER_MS, ContextSensor, OK_AFTER_MS } from '../src/vision/context';

/** feeds a constant reading every 33 ms for `ms` and returns the last advice */
function hold(s: ContextSensor, t0: number, ms: number, luma: number | null, palm: number | null) {
  let a = s.update(t0, luma, palm);
  for (let t = t0; t <= t0 + ms; t += 33) a = s.update(t, luma, palm);
  return { a, t: t0 + ms };
}

describe('ContextSensor', () => {
  it('says nothing while light and distance are fine', () => {
    const s = new ContextSensor();
    expect(hold(s, 0, 10_000, 140, 0.25).a.message).toBeNull();
  });
  it('a short shadow is not a problem', () => {
    const s = new ContextSensor();
    hold(s, 0, 1000, 140, 0.25);
    expect(hold(s, 1000, BAD_AFTER_MS - 500, 40, 0.25).a.light).toBe('ok');
  });
  it('dark for a while: asks for more light', () => {
    const s = new ContextSensor();
    const { a } = hold(s, 0, BAD_AFTER_MS + 200, 40, 0.25);
    expect(a.light).toBe('dark');
    expect(a.message).toMatch(/dark/i);
  });
  it('too bright for a while', () => {
    const s = new ContextSensor();
    expect(hold(s, 0, BAD_AFTER_MS + 200, 240, 0.25).a.light).toBe('bright');
  });
  it('far and close hand', () => {
    expect(hold(new ContextSensor(), 0, BAD_AFTER_MS + 200, 140, 0.05).a.distance).toBe('far');
    expect(hold(new ContextSensor(), 0, BAD_AFTER_MS + 200, 140, 0.6).a.distance).toBe('close');
  });
  it('the message goes away only after conditions are fine for a while', () => {
    const s = new ContextSensor();
    const bad = hold(s, 0, BAD_AFTER_MS + 200, 40, 0.25);
    expect(hold(s, bad.t, OK_AFTER_MS - 500, 140, 0.25).a.light).toBe('dark');
    expect(hold(s, bad.t + OK_AFTER_MS, 600, 140, 0.25).a.light).toBe('ok');
  });
  it('hysteresis: a value just inside the limit does not clear the message', () => {
    const s = new ContextSensor();
    const bad = hold(s, 0, BAD_AFTER_MS + 200, 40, 0.25);
    // 75 is above the limit (70) but inside the 10-unit margin
    expect(hold(s, bad.t, OK_AFTER_MS + 500, 75, 0.25).a.light).toBe('dark');
  });
  it('no hand: distance keeps its last state and the light is still judged', () => {
    const s = new ContextSensor();
    const far = hold(s, 0, BAD_AFTER_MS + 200, 140, 0.05);
    expect(hold(s, far.t, 5000, 140, null).a.distance).toBe('far');
    const dark = hold(new ContextSensor(), 0, BAD_AFTER_MS + 200, 30, null);
    expect(dark.a.light).toBe('dark');
  });
  it('no brightness reading means no light advice', () => {
    expect(hold(new ContextSensor(), 0, 10_000, null, 0.25).a.message).toBeNull();
  });
  it('light is reported before distance', () => {
    const { a } = hold(new ContextSensor(), 0, BAD_AFTER_MS + 200, 40, 0.05);
    expect(a.light).toBe('dark');
    expect(a.distance).toBe('far');
    expect(a.message).toMatch(/dark/i);
  });
});
