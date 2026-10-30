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

  // plain fields, not constructor parameter properties: Node strips types but cannot run those
  constructor(ttlMs: number, rateLimit: number, log: (line: string) => void = () => {}) {
    this.ttlMs = ttlMs;
    this.log = log;
    this.limiter = new RateLimiter(rateLimit);
  }

  /** false = over the presence rate limit (not stored) */
  accept(msg: PresenceRequest, now = Date.now()): boolean {
    if (!this.limiter.allow(now)) return false;
    const next: Presence = {
      userId: msg.userId,
      place: msg.place,
      rssi: msg.rssi,
      demo: msg.demo,
    };
    const changed = !same(this.value, next);
    this.value = next;
    this.updatedAt = now;
    // only changes are logged, and only the labels from the scanner's config: no address, no signal trace
    if (changed)
      this.log(
        next.userId || next.place
          ? `presence: user ${next.userId ?? '-'}, place ${next.place ?? '-'}${next.demo ? ' (DEMO device, not real Bluetooth)' : ''}`
          : 'presence: nobody found',
      );
    return true;
  }

  /** the current presence, or NOBODY when it has not been refreshed within the time limit */
  current(now = Date.now()): Presence {
    if (this.value !== NOBODY && now - this.updatedAt > this.ttlMs) this.value = NOBODY;
    return this.value;
  }
}
