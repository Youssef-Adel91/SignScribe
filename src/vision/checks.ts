import { fullyInFrame, palmFraction } from './landmarks';
import type { HandFrame } from './types';

export type CheckState = 'ok' | 'warn' | 'wait';

export interface CheckItem {
  state: CheckState;
  text: string;
}

export interface Checks {
  light: CheckItem;
  distance: CheckItem;
  hand: CheckItem;
  allOk: boolean;
}

/** Mean brightness thresholds, 0..255. Heuristics: tune them with a real camera. */
export const LUMA_MIN = 70;
export const LUMA_MAX = 215;
/** Palm length / frame height. About 0.14 at arm's length and 0.45 at 30 cm on a laptop webcam (estimate). */
export const PALM_MIN = 0.12;
export const PALM_MAX = 0.45;

export function evaluateChecks(luma: number | null, frame: HandFrame | null): Checks {
  const light: CheckItem =
    luma === null
      ? { state: 'wait', text: 'Measuring the light…' }
      : luma < LUMA_MIN
        ? { state: 'warn', text: 'Too dark. Turn on a light.' }
        : luma > LUMA_MAX
          ? { state: 'warn', text: 'Too bright. Avoid a window behind you.' }
          : { state: 'ok', text: 'Good light on your hands' };

  const hand0 = frame && frame.hands.length > 0 ? frame.hands[0] : null;
  let distance: CheckItem;
  let hand: CheckItem;
  if (!frame || !hand0) {
    distance = { state: 'wait', text: 'Show one hand to the camera' };
    hand = { state: 'wait', text: 'No hand yet. Raise one hand.' };
  } else {
    const pf = palmFraction(hand0, frame.width, frame.height);
    distance =
      pf < PALM_MIN
        ? { state: 'warn', text: 'A bit far. Move a little closer.' }
        : pf > PALM_MAX
          ? { state: 'warn', text: 'A bit close. Move back a little.' }
          : { state: 'ok', text: 'Distance is good' };
    hand = fullyInFrame(hand0)
      ? { state: 'ok', text: 'Your whole hand is in view' }
      : { state: 'warn', text: 'Part of your hand is outside the picture' };
  }
  return {
    light,
    distance,
    hand,
    allOk: light.state === 'ok' && distance.state === 'ok' && hand.state === 'ok',
  };
}

/** Mean luma (0..255) of an RGBA pixel buffer. */
export function meanLuma(rgba: Uint8ClampedArray | number[]): number {
  let sum = 0;
  const n = Math.floor(rgba.length / 4);
  if (n === 0) return 0;
  for (let i = 0; i < n; i++) {
    sum += 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2];
  }
  return sum / n;
}

/** Frames per second from the last few frame timestamps (ms). */
export class FpsMeter {
  private times: number[] = [];
  tick(t: number): number {
    this.times.push(t);
    if (this.times.length > 30) this.times.shift();
    if (this.times.length < 2) return 0;
    const span = this.times[this.times.length - 1] - this.times[0];
    return span > 0 ? ((this.times.length - 1) * 1000) / span : 0;
  }
}
