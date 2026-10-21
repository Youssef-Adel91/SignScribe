import { useEffect, useRef } from 'react';
import { onMachineEvent } from '../state/MachineProvider';

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
