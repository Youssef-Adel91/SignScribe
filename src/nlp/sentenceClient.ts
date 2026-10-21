import type { PlaceName, ServerMessage, SuggestRequest } from './protocol';

export interface Suggestion {
  sentence: string;
  source: 'llm' | 'offline';
  note?: string;
}

export interface SentenceClient {
  suggest(words: string[], place: PlaceName, attempt: number, avoid: string[]): Promise<Suggestion>;
  close(): void;
}

/**
 * The server address may come from the build (`VITE_SENTENCE_URL`, trusted) or, for development, from
 * `?server=` in the page address. A link must not be able to send a person's words to a stranger's
 * server, so the address in the URL is accepted only when it points at this computer.
 */
export function resolveSentenceUrl(search: string, buildUrl: string | undefined): string | null {
  const fromBuild = (buildUrl ?? '').trim();
  if (/^wss?:\/\//.test(fromBuild)) return fromBuild;
  const asked = new URLSearchParams(search).get('server');
  if (!asked) return null;
  try {
    const u = new URL(asked);
    const local =
      u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
    return (u.protocol === 'ws:' || u.protocol === 'wss:') && local ? u.toString() : null;
  } catch {
    return null;
  }
}

type WsCtor = new (url: string) => {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
};

/** WebSocket client for the sentence server. Connects when first needed and again after a drop. */
export class WsSentenceClient implements SentenceClient {
  private ws: InstanceType<WsCtor> | null = null;
  private opening: Promise<void> | null = null;
  private seq = 0;
  private readonly pending = new Map<string, (m: ServerMessage) => void>();
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly Ctor: WsCtor;

  constructor(url: string, timeoutMs = 3500, Ctor: WsCtor = WebSocket as unknown as WsCtor) {
    this.url = url;
    this.timeoutMs = timeoutMs;
    this.Ctor = Ctor;
  }

  private open(): Promise<void> {
    if (this.ws && this.ws.readyState === 1) return Promise.resolve();
    if (this.opening) return this.opening;
    this.opening = new Promise<void>((resolve, reject) => {
      const ws = new this.Ctor(this.url);
      this.ws = ws;
      ws.onopen = () => {
        this.opening = null;
        resolve();
      };
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data)) as ServerMessage;
          this.pending.get(m.id)?.(m);
        } catch {
          /* ignore a message we cannot read */
        }
      };
      const dropped = () => {
        this.opening = null;
        this.ws = null;
        reject(new Error('sentence server not reachable'));
      };
      ws.onerror = dropped;
      ws.onclose = dropped;
    });
    return this.opening;
  }

  async suggest(
    words: string[],
    place: PlaceName,
    attempt: number,
    avoid: string[],
  ): Promise<Suggestion> {
    await this.open();
    const id = `s${++this.seq}`;
    const req: SuggestRequest = {
      id,
      type: 'suggest',
      words,
      place,
      attempt,
      ...(avoid.length ? { avoid: avoid.slice(-3) } : {}),
    };
    return new Promise<Suggestion>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('sentence server too slow'));
      }, this.timeoutMs);
      this.pending.set(id, (m) => {
        clearTimeout(timer);
        this.pending.delete(id);
        if (m.ok && m.type === 'suggest')
          resolve({ sentence: m.sentence, source: m.source, note: m.note });
        else reject(new Error(m.ok ? 'unexpected answer' : m.message));
      });
      try {
        this.ws!.send(JSON.stringify(req));
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.pending.clear();
  }
}
