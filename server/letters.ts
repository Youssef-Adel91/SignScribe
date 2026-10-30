import type { LetterPush, LetterRequest } from '../src/nlp/protocol.ts';
import { RateLimiter } from './handler.ts';

/**
 * Passes letters recognised by another program (the dollarpy client) on to the apps. Nothing is stored and the
 * letters are not logged (they are the person's words): only a count. Has its own rate limit.
 */
export class LetterRelay {
  private readonly limiter: RateLimiter;
  private readonly listeners = new Set<(l: LetterPush) => void>();
  private count = 0;

  constructor(rateLimit: number) {
    this.limiter = new RateLimiter(rateLimit);
  }

  subscribe(listener: (l: LetterPush) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** false = over the letter rate limit (not passed on) */
  accept(msg: LetterRequest, now = Date.now()): boolean {
    if (!this.limiter.allow(now)) return false;
    this.count++;
    const push: LetterPush = {
      type: 'letter',
      letter: msg.letter,
      score: msg.score,
      source: msg.source,
      demo: msg.demo,
    };
    for (const l of this.listeners) l(push);
    return true;
  }

  /** how many letters were passed on since the server started */
  get relayed(): number {
    return this.count;
  }
}
