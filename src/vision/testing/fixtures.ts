import { LM } from '../landmarks';
import type { HandFrame, HandObs, Landmark } from '../types';

/**
 * SYNTHETIC hands built from a simple anatomical model (not recorded from a person).
 * They let tests and the dev simulator feed the real gesture engine without a camera, but they say
 * nothing about how well the classifier works on real hands: that has to be measured with a camera.
 *
 * Hand frame: wrist at the origin, +y along the fingers, palm length (wrist to middle knuckle) = 1.
 */
export type Pose =
  | 'open'
  | 'fist'
  | 'thumbsUp'
  | 'thumbsDown'
  | 'point'
  | 'peace'
  | 'fistThumbSide'
  | 'halfCurl';

interface Opts {
  /** centre of the palm in the un-mirrored frame, 0..1 */
  cx?: number;
  cy?: number;
  /** palm length as a fraction of frame height */
  size?: number;
  /** extra rotation in degrees (image space, clockwise) */
  rot?: number;
  handedness?: 'Left' | 'Right';
  width?: number;
  height?: number;
  /** 0 straight .. 1 fully curled, for the 'halfCurl' pose */
  curl?: number;
  /** small deterministic noise in pixels */
  jitterPx?: number;
  seed?: number;
}

type V = [number, number];
const MCP: Record<string, V> = {
  index: [-0.28, 0.95],
  middle: [0, 1.0],
  ring: [0.26, 0.95],
  pinky: [0.5, 0.82],
};
const SCALE: Record<string, number> = { index: 1, middle: 1.08, ring: 1, pinky: 0.8 };

function finger(name: string, curl: number): V[] {
  const [mx, my] = MCP[name];
  const s = SCALE[name];
  const ext: V[] = [
    [mx, my + 0.42 * s],
    [mx, my + 0.67 * s],
    [mx, my + 0.89 * s],
  ];
  // projected view of a fist: the segments fold over the palm and the tip ends below the knuckle
  const fold: V[] = [
    [mx, my + 0.12],
    [mx, my + 0.0],
    [mx, my - 0.3],
  ];
  return ext.map((e, i) => [e[0] + (fold[i][0] - e[0]) * curl, e[1] + (fold[i][1] - e[1]) * curl]);
}

function thumb(mode: 'out' | 'folded' | 'adducted'): V[] {
  const cmc: V = [-0.25, 0.3];
  const mcp: V = [-0.45, 0.55];
  if (mode === 'out') {
    // hitch-hiker thumb, perpendicular to the fingers
    return [cmc, mcp, [-0.82, 0.6], [-1.2, 0.66]];
  }
  if (mode === 'adducted') {
    // relaxed thumb of an open palm: next to the index finger
    return [cmc, mcp, [-0.52, 0.8], [-0.56, 1.0]];
  }
  // folded across the palm
  return [cmc, [-0.38, 0.5], [-0.22, 0.58], [-0.08, 0.64]];
}

export function makeHandLandmarks(pose: Pose, o: Opts = {}): Landmark[] {
  const curlOf: Record<string, number> = { index: 1, middle: 1, ring: 1, pinky: 1 };
  let th: 'out' | 'folded' | 'adducted' = 'folded';
  let rot = 0;
  switch (pose) {
    case 'open':
      for (const k of Object.keys(curlOf)) curlOf[k] = 0;
      th = 'adducted';
      break;
    case 'fist':
      break;
    case 'fistThumbSide':
      th = 'out';
      break;
    case 'thumbsUp':
      th = 'out';
      rot = 90; // turns the thumb (which points to -x in the hand frame) to point up on screen
      break;
    case 'thumbsDown':
      th = 'out';
      rot = -90;
      break;
    case 'point':
      curlOf.index = 0;
      break;
    case 'peace':
      curlOf.index = 0;
      curlOf.middle = 0;
      break;
    case 'halfCurl':
      for (const k of Object.keys(curlOf)) curlOf[k] = o.curl ?? 0.5;
      th = 'adducted';
      break;
  }
  const pts: V[] = [[0, 0], ...thumb(th)];
  for (const name of ['index', 'middle', 'ring', 'pinky']) {
    pts.push([MCP[name][0], MCP[name][1]], ...finger(name, curlOf[name]));
  }
  const w = o.width ?? 1280;
  const h = o.height ?? 720;
  const size = (o.size ?? 0.22) * h; // palm length in px
  const a = ((rot + (o.rot ?? 0)) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // palm centre in hand frame (mean of wrist + 4 knuckles)
  const pcx = (0 + MCP.index[0] + MCP.middle[0] + MCP.ring[0] + MCP.pinky[0]) / 5;
  const pcy = (0 + MCP.index[1] + MCP.middle[1] + MCP.ring[1] + MCP.pinky[1]) / 5;
  let seed = o.seed ?? 1;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296 - 0.5;
  };
  const j = o.jitterPx ?? 0;
  return pts.map(([x, y]) => {
    // image space: x right, y down; hand "up" (+y) is image up (-y)
    const dx = (x - pcx) * size;
    const dy = -(y - pcy) * size;
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return {
      x: ((o.cx ?? 0.5) * w + rx + j * rnd()) / w,
      y: ((o.cy ?? 0.5) * h + ry + j * rnd()) / h,
      z: 0,
    };
  });
}

export function makeHand(pose: Pose, o: Opts = {}): HandObs {
  return {
    landmarks: makeHandLandmarks(pose, o),
    handedness: o.handedness ?? 'Right',
    score: 0.98,
  };
}

export function makeFrame(t: number, hands: HandObs[], width = 1280, height = 720): HandFrame {
  return { t, hands, width, height };
}

/** index fingertip of a hand, un-mirrored normalised (helper for pointer tests) */
export const indexTip = (h: HandObs) => h.landmarks[LM.INDEX_TIP];
