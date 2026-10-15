import { makeFrame, makeHand, type Pose } from './testing/fixtures';
import { LM } from './landmarks';
import type { HandFrame } from './types';

export interface MockHand {
  pose: Pose;
  cx?: number;
  cy?: number;
  size?: number;
  rot?: number;
  handedness?: 'Left' | 'Right';
}

export interface MockApi {
  /** Feed synthetic hands for `ms` of VIRTUAL time (33 ms per frame, no real waiting). */
  play(hands: MockHand[], ms: number): Promise<void>;
  /** a pointing hand whose fingertip lands on viewport pixel (sx, sy) */
  pointAt(sx: number, sy: number): MockHand;
  setLuma(v: number): void;
  now(): number;
}

declare global {
  interface Window {
    __signscribe?: MockApi;
  }
}

const sleep = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Test hook (only installed with ?dev=1&vision=mock): lets Playwright act as a camera by feeding
 * landmark frames straight into the real gesture engine. The camera, MediaPipe and the model are
 * not involved, so this proves the logic behind the screens but nothing about real hand tracking.
 */
export function installMock(
  push: (frame: HandFrame) => void,
  setLuma: (v: number) => void,
): () => void {
  let t = 1000;
  const api: MockApi = {
    async play(hands, ms) {
      const end = t + ms;
      for (; t < end; t += 33) {
        push(
          makeFrame(
            t,
            hands.map((h) => makeHand(h.pose, { size: 0.2, ...h })),
          ),
        );
        await sleep(); // let React render the screen the last frame may have changed
      }
    },
    pointAt(sx, sy) {
      const tip = makeHand('point', { size: 0.2 }).landmarks[LM.INDEX_TIP];
      const m = 0.12; // same margin as cameraToScreen
      const span = 1 - 2 * m;
      const want = {
        x: 1 - m - (span * sx) / window.innerWidth,
        y: m + (span * sy) / window.innerHeight,
      };
      return { pose: 'point', cx: want.x - (tip.x - 0.5), cy: want.y - (tip.y - 0.5) };
    },
    setLuma,
    now: () => t,
  };
  window.__signscribe = api;
  return () => {
    delete window.__signscribe;
  };
}
