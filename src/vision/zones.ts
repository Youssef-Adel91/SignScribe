import { mirror, palmCenter } from './landmarks';
import type { Hand } from '../state/machine';
import type { HandObs } from './types';

export type Side = 'left' | 'right';

/** The command zone sits on the side OPPOSITE the signing hand (Guiard's kinematic chain). */
export const zoneSide = (signing: Hand): Side => (signing === 'right' ? 'left' : 'right');

/** Which half of the (mirrored) picture a hand is in. */
export function sideOf(hand: HandObs): Side {
  return mirror(palmCenter(hand)).x < 0.5 ? 'left' : 'right';
}

/** Zone covers the outer 40% of the mirrored picture on its side. */
export const ZONE_EDGE = 0.4;

export function inCommandZone(hand: HandObs, signing: Hand): boolean {
  const x = mirror(palmCenter(hand)).x;
  return zoneSide(signing) === 'left' ? x <= ZONE_EDGE : x >= 1 - ZONE_EDGE;
}
