import { parseRequest, type ServerMessage } from '../src/nlp/protocol.ts';
import type { PresenceStore } from './presence.ts';
import type { SentenceService } from './sentences.ts';

/** a fixed window rate limiter, one per connection */
export class RateLimiter {
  private readonly max: number;
  private readonly windowMs: number;
  private start = 0;
  private count = 0;
  constructor(max: number, windowMs = 10_000) {
    this.max = max;
    this.windowMs = windowMs;
  }
  allow(now: number): boolean {
    if (now - this.start >= this.windowMs) {
      this.start = now;
      this.count = 0;
    }
    this.count++;
    return this.count <= this.max;
  }
}

export interface Limiter {
  allow(now: number): boolean;
}

/** A message is allowed only when every limiter allows it; all of them are counted (no short-circuit). */
export function both(a: Limiter, b: Limiter): Limiter {
  return {
    allow(now) {
      const x = a.allow(now);
      const y = b.allow(now);
      return x && y;
    },
  };
}

/** One message in, one message out. The same function serves WebSocket frames and TCP lines. */
export async function handleMessage(
  text: string,
  service: SentenceService,
  limiter: Limiter,
  now = Date.now(),
  extras: { presence?: PresenceStore } = {},
): Promise<ServerMessage> {
  const parsed = parseRequest(text);
  const id = parsed.ok ? parsed.msg.id : parsed.id;
  // every message counts, also the bad ones: garbage must not be a free way to keep the server busy
  if (!limiter.allow(now))
    return { id, ok: false, error: 'rate_limited', message: 'too many requests, slow down' };
  if (!parsed.ok) {
    const tooBig = parsed.message === 'message too large';
    return {
      id: parsed.id,
      ok: false,
      error: tooBig ? 'too_large' : 'bad_request',
      message: parsed.message,
    };
  }
  const msg = parsed.msg;
  if (msg.type === 'ping') return { id: msg.id, ok: true, type: 'pong' };
  if (msg.type === 'presence') {
    if (!extras.presence)
      return { id: msg.id, ok: false, error: 'bad_request', message: 'presence is not enabled' };
    if (!extras.presence.accept(msg, now))
      return {
        id: msg.id,
        ok: false,
        error: 'rate_limited',
        message: 'too many presence messages, slow down',
      };
    return { id: msg.id, ok: true, type: 'presence' };
  }
  try {
    return await service.suggest(msg);
  } catch {
    return {
      id: msg.id,
      ok: false,
      error: 'server_error',
      message: 'the server could not make a sentence',
    };
  }
}
