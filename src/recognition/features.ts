import type { HandObs } from '../vision/types';

/**
 * Feature vector for one hand in one frame ("hand60-v1"). It MUST stay identical to
 * ml/signscribe_ml/features.py (a golden-file test in both languages checks this):
 *   1. landmarks to pixel units (x*width, y*height, z*width: MediaPipe's z uses x's scale)
 *   2. optional mirror of x (left-handed signers are mirrored to look like right-handed ones)
 *   3. subtract the wrist, divide by the wrist to middle-finger-knuckle distance (2D, pixels)
 *   4. drop the wrist (always 0): 20 landmarks x 3 = 60 numbers
 * Rotation is deliberately NOT removed: several letters differ mainly by orientation.
 */
export const FEATURES_ID = 'hand60-v1';
export const FEATURE_LENGTH = 60;

export function staticFeatures(
  hand: Pick<HandObs, 'landmarks'>,
  width: number,
  height: number,
  mirrorX = false,
): number[] | null {
  const lm = hand.landmarks;
  if (lm.length !== 21) return null;
  const sign = mirrorX ? -1 : 1;
  const wx = lm[0].x * width;
  const wy = lm[0].y * height;
  const wz = lm[0].z * width;
  const scale = Math.hypot((lm[9].x - lm[0].x) * width, (lm[9].y - lm[0].y) * height);
  if (!(scale > 1e-6)) return null;
  const out: number[] = [];
  for (let i = 1; i < 21; i++) {
    out.push((sign * (lm[i].x * width - wx)) / scale);
    out.push((lm[i].y * height - wy) / scale);
    out.push((lm[i].z * width - wz) / scale);
  }
  return out;
}
