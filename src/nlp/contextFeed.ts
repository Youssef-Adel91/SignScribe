import { parseContextPush, type ContextPush } from './protocol';

type WsLike = {
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
};
type WsCtor = new (url: string) => WsLike;

/**
 * Listens to the sentence server for who/where the Bluetooth scanner found (messages the server pushes).
 * Connects by itself, reconnects after a drop with a growing pause, and says "nothing detected" while the
 * server is not reachable, so the app then works exactly as it does without Bluetooth.
 */
export class ContextFeed {
  private ws: WsLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private pause: number;

  constructor(
    private readonly url: string,
    private readonly onContext: (c: ContextPush | null) => void,
    private readonly Ctor: WsCtor = WebSocket as unknown as WsCtor,
    private readonly minPauseMs = 1000,
    private readonly maxPauseMs = 15000,
  ) {
    this.pause = minPauseMs;
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;
    let ws: WsLike;
    try {
      ws = new this.Ctor(this.url);
    } catch {
      this.lost();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.pause = this.minPauseMs;
    };
    ws.onmessage = (e) => {
      const c = parseContextPush(String(e.data));
      if (c) this.onContext(c.userId || c.place ? c : null);
    };
    const drop = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.lost();
    };
    ws.onclose = drop;
    ws.onerror = drop;
  }

  private lost(): void {
    if (this.closed) return;
    this.onContext(null); // no server, no Bluetooth information
    this.timer = setTimeout(() => this.connect(), this.pause);
    this.pause = Math.min(this.maxPauseMs, this.pause * 2);
  }

  close(): void {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
