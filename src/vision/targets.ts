import { useCallback, useEffect, useRef } from 'react';
import type { Ev } from '../state/machine';
import type { Target } from './dwell';

/**
 * Things the pointer can choose. A component registers its element and the machine event that
 * choosing it should send; the dwell engine reads the live rectangles every frame, so nothing here
 * depends on layout, scrolling or window size.
 */
interface Entry {
  el: HTMLElement;
  event: Ev;
}
const registry = new Map<string, Entry>();
let counter = 0;

export function getTargets(): Target[] {
  const out: Target[] = [];
  for (const [id, { el, event }] of registry) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    out.push({ id, rect: { x: r.left, y: r.top, w: r.width, h: r.height }, event });
  }
  return out;
}

/** which element is highlighted as "about to be chosen" */
export function setHot(id: string | null): void {
  for (const [key, { el }] of registry) {
    if (key === id) el.dataset.hot = 'true';
    else if (el.dataset.hot) delete el.dataset.hot;
  }
}

export const targetCount = (): number => registry.size;

/**
 * Make an element a point-and-hold target. Returns a ref callback to put on the element.
 * `event` null/undefined = not a target (for example an option that is "Coming soon").
 */
export function useDwellTarget(event: Ev | null | undefined): (el: HTMLElement | null) => void {
  const id = useRef(`t${++counter}`);
  const evRef = useRef<Ev | null>(event ?? null);
  const elRef = useRef<HTMLElement | null>(null);
  evRef.current = event ?? null;
  const key = event ? JSON.stringify(event) : '';

  useEffect(() => {
    const el = elRef.current;
    const myId = id.current;
    if (!el || !evRef.current) return;
    el.dataset.dwell = 'true';
    registry.set(myId, { el, event: evRef.current });
    return () => {
      registry.delete(myId);
      delete el.dataset.dwell;
      delete el.dataset.hot;
    };
  }, [key]);

  return useCallback((el: HTMLElement | null) => {
    elRef.current = el;
  }, []);
}
