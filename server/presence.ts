import type { PlaceName, PresenceRequest } from '../src/nlp/protocol.ts';
import { RateLimiter } from './handler.ts';

export interface Presence {
  userId: string | null;
  place: PlaceName | null;
  rssi: number | null;
  demo: boolean;
}

export const NOBODY: Presence = { userId: null, place: null, rssi: null, demo: false };

const same = (a: Presence, b: Presence) =>
  a.userId === b.userId && a.place === b.place && a.demo === b.demo;

/**
 * Who is near and where, as last reported by the Bluetooth scanner. It is kept in memory only, forgotten after
 * `ttlMs` without a refresh (scanner stopped, Bluetooth off), and never holds a device address (the protocol
 * refuses one). Its own rate limit protects it from a noisy or hostile sender.
 */
export class PresenceStore {
  private value: Presence = NOBODY;
  private updatedAt = 0;
  private readonly limiter: RateLimiter;
  private readonly ttlMs: number;
  private readonly log: (line: string) => void;
  private readonly listeners = new Set<(p: Presence) => void>();

  // plain fields, not constructor parameter properties: Node strips types but cannot run those
  constructor(ttlMs: number, rateLimit: number, log: (line: string) => void = () => {}) {
    this.ttlMs = ttlMs;
    this.log = log;
    this.limiter = new RateLimiter(rateLimit);
  }

  /** called whenever who/where changes (including when a presence expires). Returns a function that stops it */
  subscribe(listener: (p: Presence) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private tell(p: Presence) {
    for (const l of this.listeners) l(p);
  }

  /** forget a presence that was not refreshed in time and tell the listeners; call it about once a second */
  tick(now = Date.now()): void {
    const before = this.value;
    if (this.current(now) !== before) {
      this.log('presence: nobody found (not refreshed, scanner stopped or Bluetooth off)');
      this.tell(NOBODY);
    }
  }

  /** false = over the presence rate limit (not stored) */
  accept(msg: PresenceRequest, now = Date.now()): boolean {
    if (!this.limiter.allow(now)) return false;
    const found = msg.userId !== null || msg.place !== null;
    const next: Presence = found
      ? { userId: msg.userId, place: msg.place, rssi: msg.rssi, demo: msg.demo }
      : NOBODY;
    const before = this.current(now);
    const changed = !same(before, next);
    this.value = next;
    this.updatedAt = now;
    // only changes are logged, and only the labels from the scanner's config: no address, no signal trace
    if (changed)
      this.log(
        found
          ? `presence: user ${next.userId ?? '-'}, place ${next.place ?? '-'}${next.demo ? ' (DEMO device, not real Bluetooth)' : ''}`
          : 'presence: nobody found',
      );
    if (changed) this.tell(next);
    return true;
  }

  /** the current presence, or NOBODY when it has not been refreshed within the time limit */
  current(now = Date.now()): Presence {
    if (this.value !== NOBODY && now - this.updatedAt > this.ttlMs) this.value = NOBODY;
    return this.value;
  }
}
