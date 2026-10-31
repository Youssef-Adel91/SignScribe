import type { LetterPush, LetterRequest } from '../src/nlp/protocol.ts';
import { RateLimiter } from './handler.ts';

/**
 * Passes letters recognised by another program (the dollarpy client) on to the apps. The letters are not logged
 * (they are the person's words): only counts. Has its own rate limit.
 *
 * One exception to "nothing is kept": a letter that reached NO app (none connected, or the app was still connecting)
 * is held in memory for `holdMs` and handed to the first app that connects, once. A letter an app has already
 * received is never replayed. Reason: the client sends a letter the moment it recognises it; an app that is a second
 * late would otherwise lose it without anyone knowing (Windows e2e, KNOWN_ISSUES #24). The app only OFFERS the letter;
 * the person still has to point and hold to add it, so a late offer cannot write anything by itself.
 */
export class LetterRelay {
  private readonly limiter: RateLimiter;
  /** a listener returns how many apps it sent the letter to */
  private readonly listeners = new Set<(l: LetterPush) => number | void>();
  private count = 0;
  private rejected = 0;
  private held: { push: LetterPush; at: number } | null = null;

  private readonly holdMs: number;
  /** counts only, never the letter */
  private readonly log: (line: string) => void;

  constructor(rateLimit: number, holdMs = 0, log: (line: string) => void = () => {}) {
    this.holdMs = holdMs;
    this.log = log;
    this.limiter = new RateLimiter(rateLimit);
  }

  subscribe(listener: (l: LetterPush) => number | void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** false = over the letter rate limit (not passed on) */
  accept(msg: LetterRequest, now = Date.now()): boolean {
    if (!this.limiter.allow(now)) {
      this.rejected++;
      this.log(
        `letter received over the socket but over the letter limit (${this.rejected} refused so far)`,
      );
      return false;
    }
    this.count++;
    const push: LetterPush = {
      type: 'letter',
      letter: msg.letter,
      score: msg.score,
      source: msg.source,
      demo: msg.demo,
    };
    let sent = 0;
    for (const l of this.listeners) sent += l(push) ?? 0;
    if (sent === 0 && this.holdMs > 0) this.held = { push, at: now };
    this.log(
      `letter #${this.count} received; sent to ${sent} WebSocket client${sent === 1 ? '' : 's'}` +
        (sent === 0 && this.holdMs > 0
          ? `; held ${this.holdMs} ms for the next app that connects`
          : ''),
    );
    return true;
  }

  /** the letter nobody received, if it is still fresh; handing it out removes it (an app gets it once) */
  takeHeld(now = Date.now()): LetterPush | null {
    const h = this.held;
    this.held = null;
    if (!h || now - h.at > this.holdMs) return null;
    this.log(`letter #${this.count} handed to an app that connected ${now - h.at} ms later`);
    return h.push;
  }

  /** how many letters were passed on since the server started */
  get relayed(): number {
    return this.count;
  }
}
