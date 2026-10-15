import { makeFrame, makeHand, type Pose } from './testing/fixtures';
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
    setLuma,
    now: () => t,
  };
  window.__signscribe = api;
  return () => {
    delete window.__signscribe;
  };
}
