import { useEffect, useRef, useState } from 'react';
import type { Checks } from './checks';
import type { VisionUI } from './controller';
import type { HandFrame } from './types';

export type VisionStatus =
  | 'off' //       vision disabled (?vision=off, dev only)
  | 'asking' //    waiting for the browser's camera permission
  | 'starting' //  camera open, loading the hand model
  | 'running'
  | 'denied' //    permission refused
  | 'nocamera' //  no camera / camera in use
  | 'nomodel' //   public/models is empty: run `npm run models`
  | 'error';

export interface VisionState {
  status: VisionStatus;
  message: string;
  source: 'camera' | 'mock' | 'none';
  stream: MediaStream | null;
  /** camera frames per second (measured) */
  fps: number;
  /** ms the hand model took for the last frame */
  inferMs: number;
  /** mean brightness of the picture, 0..255 */
  luma: number | null;
  video: { w: number; h: number };
  frame: HandFrame | null;
  ui: VisionUI | null;
  checks: Checks | null;
}

const initial: VisionState = {
  status: 'off',
  message: '',
  source: 'none',
  stream: null,
  fps: 0,
  inferMs: 0,
  luma: null,
  video: { w: 0, h: 0 },
  frame: null,
  ui: null,
  checks: null,
};

type Listener = () => void;

class VisionStore {
  state: VisionState = initial;
  private listeners = new Set<Listener>();
  set(patch: Partial<VisionState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  reset(): void {
    this.state = initial;
    for (const l of this.listeners) l();
  }
}

export const visionStore = new VisionStore();

export const isLive = (s: VisionState): boolean => s.status === 'running';

/** Subscribe to a slice of the vision state. Re-renders only when the selected value changes. */
export function useVision<T>(select: (s: VisionState) => T): T {
  const sel = useRef(select);
  sel.current = select;
  const [value, setValue] = useState<T>(() => select(visionStore.state));
  useEffect(() => {
    const update = () => {
      const next = sel.current(visionStore.state);
      setValue((prev) => (Object.is(prev, next) ? prev : next));
    };
    update();
    return visionStore.subscribe(update);
  }, []);
  return value;
}
