import type { Pt } from './types';

/**
 * One-Euro filter (Casiez et al. 2012): smooths hard when the finger is nearly still (so the
 * pointer does not shake) and hardly at all when it moves fast (so it does not lag).
 */
export class OneEuro {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev = 0;

  constructor(
    private readonly minCutoff = 1.0,
    private readonly beta = 0.01,
    private readonly dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: number, tMs: number): number {
    if (this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = tMs;
      return x;
    }
    const dt = Math.max((tMs - this.tPrev) / 1000, 1e-3);
    const dx = (x - this.xPrev) / dt;
    const aD = OneEuro.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuro.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = tMs;
    return xHat;
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
  }
}

export class PointerFilter {
  private fx: OneEuro;
  private fy: OneEuro;
  constructor(minCutoff = 1.0, beta = 0.01) {
    this.fx = new OneEuro(minCutoff, beta);
    this.fy = new OneEuro(minCutoff, beta);
  }
  filter(p: Pt, t: number): Pt {
    return { x: this.fx.filter(p.x, t), y: this.fy.filter(p.y, t) };
  }
  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}

/**
 * Camera point (un-mirrored, 0..1) to a viewport pixel. The picture is mirrored, like a mirror, so
 * moving your hand to the right moves the pointer to the right. The outer `margin` of the camera
 * frame is not used, so the edges of the screen can be reached without leaving the camera's view.
 */
export function cameraToScreen(p: Pt, vw: number, vh: number, margin = 0.12): Pt {
  const span = 1 - 2 * margin;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const x = clamp((1 - p.x - margin) / span);
  const y = clamp((p.y - margin) / span);
  return { x: x * vw, y: y * vh };
}
