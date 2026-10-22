import { LUMA_MAX, LUMA_MIN, PALM_MAX, PALM_MIN } from './checks';

export type LightAdvice = 'ok' | 'dark' | 'bright';
export type DistanceAdvice = 'ok' | 'far' | 'close';

export interface ContextAdvice {
  light: LightAdvice;
  distance: DistanceAdvice;
  /** one short sentence for the person, or null when everything is fine */
  message: string | null;
}

export const NO_ADVICE: ContextAdvice = { light: 'ok', distance: 'ok', message: null };

/** a problem must last this long before it is shown (a passing shadow is not a problem) */
export const BAD_AFTER_MS = 3000;
/** and it must be gone this long before the message goes away */
export const OK_AFTER_MS = 2000;
/** to count as "back to normal" a value must be this far inside the limit (hysteresis) */
const LUMA_MARGIN = 10;
const PALM_MARGIN = 0.02;

const MESSAGES = {
  dark: 'It is getting dark. Turn on a light so the camera can see your hand.',
  bright: 'Too much light behind you. Face the light, away from the window.',
  far: 'Your hand is far from the camera. Move a little closer.',
  close: 'Your hand is very close. Move back a little.',
} as const;

/** One dimension (light or distance): raw reading -> debounced state with hysteresis. */
class Debounced<S extends string> {
  state: S;
  private candidate: S;
  private since: number | null = null;
  constructor(private readonly ok: S) {
    this.state = ok;
    this.candidate = ok;
  }
  update(t: number, raw: S | null): S {
    if (raw === null) return this.state; // no reading (no hand): keep what we know
    if (raw === this.state) {
      this.since = null;
      this.candidate = raw;
      return this.state;
    }
    if (raw !== this.candidate) {
      this.candidate = raw;
      this.since = t;
    }
    const need = raw === this.ok ? OK_AFTER_MS : BAD_AFTER_MS;
    if (this.since !== null && t - this.since >= need) {
      this.state = raw;
      this.since = null;
    }
    return this.state;
  }
}

/**
 * Watches light and hand distance while the app is in use and says when conditions drift away from
 * what the setup checks accepted. Pure: feed it time, brightness (0..255) and the palm size
 * (fraction of the frame height, null when no hand is visible).
 */
export class ContextSensor {
  private readonly light = new Debounced<LightAdvice>('ok');
  private readonly distance = new Debounced<DistanceAdvice>('ok');

  update(t: number, luma: number | null, palm: number | null): ContextAdvice {
    const lightNow = this.light.state;
    const rawLight: LightAdvice | null =
      luma === null
        ? null
        : luma < LUMA_MIN || (lightNow === 'dark' && luma < LUMA_MIN + LUMA_MARGIN)
          ? 'dark'
          : luma > LUMA_MAX || (lightNow === 'bright' && luma > LUMA_MAX - LUMA_MARGIN)
            ? 'bright'
            : 'ok';
    const distNow = this.distance.state;
    const rawDist: DistanceAdvice | null =
      palm === null
        ? null
        : palm < PALM_MIN || (distNow === 'far' && palm < PALM_MIN + PALM_MARGIN)
          ? 'far'
          : palm > PALM_MAX || (distNow === 'close' && palm > PALM_MAX - PALM_MARGIN)
            ? 'close'
            : 'ok';
    const light = this.light.update(t, rawLight);
    const distance = this.distance.update(t, rawDist);
    const message =
      light !== 'ok' ? MESSAGES[light] : distance !== 'ok' ? MESSAGES[distance] : null;
    return light === 'ok' && distance === 'ok' ? NO_ADVICE : { light, distance, message };
  }
}
