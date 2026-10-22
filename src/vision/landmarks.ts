import type { HandObs, Pt } from './types';

/** MediaPipe hand landmark indices. */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export const FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;
export type Finger = (typeof FINGERS)[number];
const MCP: Record<Finger, number> = {
  index: LM.INDEX_MCP,
  middle: LM.MIDDLE_MCP,
  ring: LM.RING_MCP,
  pinky: LM.PINKY_MCP,
};
const TIP: Record<Finger, number> = {
  index: LM.INDEX_TIP,
  middle: LM.MIDDLE_TIP,
  ring: LM.RING_TIP,
  pinky: LM.PINKY_TIP,
};

/** landmark in pixels (x and y are normalised separately, so distances must be measured in pixels) */
export const px = (hand: HandObs, i: number, w: number, h: number): Pt => ({
  x: hand.landmarks[i].x * w,
  y: hand.landmarks[i].y * h,
});

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** smooth 0..1 ramp between lo and hi */
export const smooth = (v: number, lo: number, hi: number): number => {
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/** wrist to middle-finger knuckle, in pixels: the scale everything else is measured in */
export function palmSize(hand: HandObs, w: number, h: number): number {
  return dist(px(hand, LM.WRIST, w, h), px(hand, LM.MIDDLE_MCP, w, h));
}

/**
 * 0..1: how stretched out a finger is. It is the ratio (wrist to tip) / (wrist to knuckle):
 * about 1.9 when the finger is straight and about 0.7 when it is curled into a fist. It does not
 * depend on how the hand is rotated or how big it is on screen.
 */
export function fingerExtension(hand: HandObs, f: Finger, w: number, h: number): number {
  const wrist = px(hand, LM.WRIST, w, h);
  const mcp = dist(wrist, px(hand, MCP[f], w, h));
  if (mcp < 1e-6) return 0;
  const ratio = dist(wrist, px(hand, TIP[f], w, h)) / mcp;
  return smooth(ratio, 1.1, 1.6);
}

/** 0..1: how far the thumb tip is from the index knuckle (a folded thumb lies against the palm) */
export function thumbExtension(hand: HandObs, w: number, h: number): number {
  const ps = palmSize(hand, w, h);
  if (ps < 1e-6) return 0;
  const d = dist(px(hand, LM.THUMB_TIP, w, h), px(hand, LM.INDEX_MCP, w, h)) / ps;
  return smooth(d, 0.5, 0.85);
}

/**
 * Where the thumb points on screen: +1 straight up, -1 straight down, 0 sideways.
 * (Image y grows downwards, so "up" is a negative y.)
 */
export function thumbVertical(hand: HandObs, w: number, h: number): number {
  const a = px(hand, LM.THUMB_MCP, w, h);
  const b = px(hand, LM.THUMB_TIP, w, h);
  const len = dist(a, b);
  if (len < 1e-6) return 0;
  return -(b.y - a.y) / len;
}

/** centre of the palm, normalised 0..1 of the un-mirrored frame */
export function palmCenter(hand: HandObs): Pt {
  const ids = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];
  let x = 0;
  let y = 0;
  for (const i of ids) {
    x += hand.landmarks[i].x;
    y += hand.landmarks[i].y;
  }
  return { x: x / ids.length, y: y / ids.length };
}

/** Is every landmark inside the frame (with a small margin)? */
export function fullyInFrame(hand: HandObs, margin = 0.01): boolean {
  return hand.landmarks.every(
    (l) => l.x > margin && l.x < 1 - margin && l.y > margin && l.y < 1 - margin,
  );
}

/** The mirrored (selfie-view) position of a normalised point. */
export const mirror = (p: Pt): Pt => ({ x: 1 - p.x, y: p.y });

/** Palm length as a fraction of frame height: a proxy for how far the hand is from the camera. */
export const palmFraction = (hand: HandObs, w: number, h: number): number =>
  palmSize(hand, w, h) / h;

/** Is the palm facing the camera? (sign of the 2D cross product wrist->index x wrist->pinky, flipped for handedness) */
export function palmFacing(hand: HandObs): boolean {
  const w = hand.landmarks[LM.WRIST];
  const i = hand.landmarks[LM.INDEX_MCP];
  const p = hand.landmarks[LM.PINKY_MCP];
  const cross = (i.x - w.x) * (p.y - w.y) - (i.y - w.y) * (p.x - w.x);
  return hand.handedness === 'Right' ? cross < 0 : cross > 0;
}

/** Pinch distance (thumb tip to index tip) in palm lengths. */
export function pinchDistance(hand: HandObs, w: number, h: number): number {
  const ps = palmSize(hand, w, h);
  if (ps < 1e-6) return Infinity;
  return dist(px(hand, LM.THUMB_TIP, w, h), px(hand, LM.INDEX_TIP, w, h)) / ps;
}

/** Overall openness: mean extension of the four fingers (0 fist, 1 open palm). */
export function openness(hand: HandObs, w: number, h: number): number {
  return FINGERS.reduce((s, f) => s + fingerExtension(hand, f, w, h), 0) / FINGERS.length;
}
