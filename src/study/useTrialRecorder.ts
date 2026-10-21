import { useEffect, useRef } from 'react';
import { onMachineEvent } from '../state/MachineProvider';
import { visionStore } from '../vision/store';

export interface Counters {
  corrections: number;
  rejections: number;
  backs: number;
  handLost: number;
}
export const zeroCounters = (): Counters => ({
  corrections: 0,
  rejections: 0,
  backs: 0,
  handLost: 0,
});

/**
 * Counts what happens in the camera version of a trial, from the events the machine receives:
 * DELETE = correction, NO on the sentence screen (11) = rejection ("try another"), NO elsewhere =
 * back, HAND_LOST = the hand left the picture. Counting is active only while `active` is true.
 */
export function useTrialRecorder(active: boolean) {
  const c = useRef<Counters>(zeroCounters());
  const on = useRef(active);
  useEffect(() => {
    on.current = active;
    if (active) c.current = zeroCounters();
  }, [active]);
  useEffect(
    () =>
      onMachineEvent((e, screen) => {
        if (!on.current) return;
        if (e.type === 'DELETE') c.current.corrections++;
        else if (e.type === 'NO' && screen === 11) c.current.rejections++;
        else if (e.type === 'NO' && screen !== 13) c.current.backs++;
        else if (e.type === 'HAND_LOST') c.current.handLost++;
      }),
    [],
  );
  return c;
}

export interface CameraStats {
  cameraFps: number | null;
  inferMsMean: number | null;
  delegate: 'GPU' | 'CPU' | null;
}
export const NO_CAMERA_STATS: CameraStats = { cameraFps: null, inferMsMean: null, delegate: null };

/**
 * What the real camera pipeline did while a camera trial ran: frames per second and the mean time
 * of the hand model, measured from the frames themselves. With the mock camera they are null, so a
 * synthetic session never writes camera numbers into the data.
 */
export function useCameraStats(active: boolean): () => CameraStats {
  const acc = useRef({ frames: 0, first: 0, last: 0, infer: 0 });
  useEffect(() => {
    if (!active) return;
    acc.current = { frames: 0, first: 0, last: 0, infer: 0 };
    let seen: unknown = null;
    return visionStore.subscribe(() => {
      const st = visionStore.state;
      if (st.source !== 'camera' || !st.frame || st.frame === seen) return;
      seen = st.frame;
      const a = acc.current;
      if (a.frames === 0) a.first = st.frame.t;
      a.last = st.frame.t;
      a.frames++;
      a.infer += st.inferMs;
    });
  }, [active]);
  return () => {
    const a = acc.current;
    if (a.frames < 2 || a.last <= a.first) return NO_CAMERA_STATS;
    return {
      cameraFps: ((a.frames - 1) * 1000) / (a.last - a.first),
      inferMsMean: a.infer / a.frames,
      delegate: visionStore.state.delegate,
    };
  };
}
