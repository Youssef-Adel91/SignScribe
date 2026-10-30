// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { PRESENCE, parseRequest, type PresenceRequest } from '../src/nlp/protocol';
import { loadConfig } from '../server/config';
import { RateLimiter, handleMessage } from '../server/handler';
import { start, type Running } from '../server/index';
import { PresenceStore } from '../server/presence';
import { SentenceService } from '../server/sentences';

const msg = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: 'p1',
    type: 'presence',
    userId: 'youssef',
    place: 'Clinic',
    rssi: -58,
    demo: false,
    ...over,
  });

describe('presence message (Bluetooth scanner -> server)', () => {
  it('accepts user, place and signal, and a "nobody found" message', () => {
    const p = parseRequest(msg());
    expect(p.ok && p.msg).toEqual({
      id: 'p1',
      type: 'presence',
      userId: 'youssef',
      place: 'Clinic',
      rssi: -58,
      demo: false,
    });
    const none = parseRequest(msg({ userId: null, place: null, rssi: null }));
    expect(none.ok && (none.msg as PresenceRequest).userId).toBeNull();
    const placeOnly = parseRequest(msg({ userId: null }));
    expect(placeOnly.ok).toBe(true);
  });
  it('demo is false unless the scanner says true', () => {
    const a = parseRequest(msg({ demo: undefined }));
    expect(a.ok && (a.msg as PresenceRequest).demo).toBe(false);
    const b = parseRequest(msg({ demo: true }));
    expect(b.ok && (b.msg as PresenceRequest).demo).toBe(true);
  });
  it.each([
    ['an address field', { address: 'AA:BB:CC:DD:EE:01' }, /unknown field 'address'/],
    ['a device name field', { name: "Sara's phone" }, /unknown field 'name'/],
    ['a user id with a space', { userId: 'a b' }, /userId/],
    ['a user id that is too long', { userId: 'x'.repeat(33) }, /userId/],
    ['an address as the user id', { userId: 'AA:BB:CC:DD:EE:01' }, /userId/],
    ['a number as the user id', { userId: 5 }, /userId/],
    ['a place that does not exist', { place: 'Moon' }, /place/],
    ['a positive rssi', { rssi: 5 }, /rssi/],
    ['an rssi below -127', { rssi: -128 }, /rssi/],
    ['a fractional rssi', { rssi: -50.5 }, /rssi/],
    ['no rssi although someone was found', { rssi: null }, /rssi/],
    ['an rssi although nobody was found', { userId: null, place: null }, /null when nothing/],
    ['demo as text', { demo: 'yes' }, /demo/],
  ])('refuses %s', (_n, over, re) => {
    const p = parseRequest(msg(over));
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toMatch(re);
  });
  it('allows only the documented fields', () => {
    expect(PRESENCE.fields).toEqual(['id', 'type', 'userId', 'place', 'rssi', 'demo']);
  });
});

const ok = (over: Partial<PresenceRequest> = {}): PresenceRequest => ({
  id: 'p',
  type: 'presence',
  userId: 'youssef',
  place: 'Clinic',
  rssi: -58,
  demo: false,
  ...over,
});

describe('PresenceStore', () => {
  it('holds the last presence, forgets it after the time limit and refreshes on a heartbeat', () => {
    const s = new PresenceStore(1000, 100);
    expect(s.current(0).userId).toBeNull();
    s.accept(ok(), 0);
    expect(s.current(900)).toMatchObject({ userId: 'youssef', place: 'Clinic' });
    s.accept(ok(), 900); // heartbeat
    expect(s.current(1800).userId).toBe('youssef');
    expect(s.current(2000).userId).toBeNull();
  });
  it('has its own rate limit, separate from the per-connection one', () => {
    const s = new PresenceStore(1000, 3);
    expect([1, 2, 3, 4].map((i) => s.accept(ok(), i))).toEqual([true, true, true, false]);
    expect(s.accept(ok(), 10_001)).toBe(true);
  });
  it('logs only changes, with the config labels and never a signal trace or address', () => {
    const lines: string[] = [];
    const s = new PresenceStore(1000, 100, (l) => lines.push(l));
    s.accept(ok({ rssi: -50 }), 0);
    s.accept(ok({ rssi: -70 }), 1);
    s.accept(ok({ userId: null, place: null, rssi: null }), 2);
    s.accept(ok({ demo: true }), 3);
    expect(lines).toEqual([
      'presence: user youssef, place Clinic',
      'presence: nobody found',
      'presence: user youssef, place Clinic (DEMO device, not real Bluetooth)',
    ]);
    expect(lines.join()).not.toMatch(/-\d\d|rssi/);
  });
});

describe('handler: presence', () => {
  const svc = new SentenceService({ provider: null, timeoutMs: 100 });
  it('acknowledges, stores, and counts against the connection limit too', async () => {
    const presence = new PresenceStore(1000, 100);
    const lim = new RateLimiter(2);
    expect(await handleMessage(msg(), svc, lim, 0, { presence })).toEqual({
      id: 'p1',
      ok: true,
      type: 'presence',
    });
    expect(presence.current(1).place).toBe('Clinic');
    await handleMessage(msg(), svc, lim, 0, { presence });
    expect(await handleMessage(msg(), svc, lim, 0, { presence })).toMatchObject({
      ok: false,
      error: 'rate_limited',
    });
  });
  it('answers rate_limited from the presence limit and does not store the message', async () => {
    const presence = new PresenceStore(1000, 1);
    const lim = new RateLimiter(100);
    await handleMessage(msg(), svc, lim, 0, { presence });
    const r = await handleMessage(msg({ userId: 'sara' }), svc, lim, 1, { presence });
    expect(r).toMatchObject({ ok: false, error: 'rate_limited' });
    expect(presence.current(2).userId).toBe('youssef');
  });
  it('a message with an address is refused and never reaches the store or the log', async () => {
    const lines: string[] = [];
    const presence = new PresenceStore(1000, 100, (l) => lines.push(l));
    const r = await handleMessage(
      msg({ address: 'AA:BB:CC:DD:EE:01' }),
      svc,
      new RateLimiter(9),
      0,
      {
        presence,
      },
    );
    expect(r).toMatchObject({ ok: false, error: 'bad_request' });
    expect(presence.current(1).userId).toBeNull();
    expect(lines).toEqual([]);
    expect(JSON.stringify(r)).not.toContain('AA:BB');
  });
  it('without a presence store the message is refused plainly', async () => {
    expect(await handleMessage(msg(), svc, new RateLimiter(9))).toMatchObject({
      ok: false,
      error: 'bad_request',
    });
  });
});

describe('presence over a real TCP socket', () => {
  let srv: Running;
  const log: string[] = [];
  beforeAll(async () => {
    srv = await start(
      { ...loadConfig({}), provider: 'fake', wsPort: 0, tcpPort: 0, presenceRateLimit: 3 },
      (l) => log.push(l),
    );
  });
  afterAll(async () => srv.close());
  const lines = (n: number, payload: string) =>
    new Promise<string[]>((resolve, reject) => {
      const out: string[] = [];
      const s = net.createConnection(srv.tcpPort, '127.0.0.1');
      let buf = '';
      s.setEncoding('utf8');
      s.on('data', (d: string) => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          out.push(buf.slice(0, i));
          buf = buf.slice(i + 1);
        }
        if (out.length === n) {
          s.end();
          resolve(out);
        }
      });
      s.on('error', reject);
      s.write(payload);
    });
  it('one JSON line in, one acknowledgement out, then the presence limit applies', async () => {
    const r = (
      await lines(5, [1, 2, 3, 4, 5].map((i) => msg({ id: `m${i}` })).join('\n') + '\n')
    ).map((l) => JSON.parse(l));
    const byId = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(byId.m1).toMatchObject({ ok: true, type: 'presence' });
    expect(r.filter((x) => x.ok).length).toBe(3);
    expect(r.filter((x) => x.error === 'rate_limited').length).toBe(2);
    expect(log.filter((l) => l.startsWith('presence:'))).toEqual([
      'presence: user youssef, place Clinic',
    ]);
  });
});

describe('the server runs under plain Node', () => {
  it('every server file loads with `node` itself (it strips types but cannot run every TypeScript feature)', () => {
    for (const f of readdirSync('server').filter((n) => n.endsWith('.ts'))) {
      const out = execFileSync(
        'node',
        ['-e', `import('./server/${f}').then(() => console.log('ok'))`],
        {
          encoding: 'utf8',
        },
      );
      expect(out.trim(), f).toBe('ok');
    }
  });
});

describe('PresenceStore: listeners and expiry', () => {
  it('tells listeners about changes, not about repeats, and when a presence expires', () => {
    const s = new PresenceStore(1000, 100);
    const seen: (string | null)[] = [];
    const stop = s.subscribe((p) => seen.push(p.userId));
    s.accept(ok(), 0);
    s.accept(ok({ rssi: -70 }), 100); // same person and place
    s.accept(ok({ userId: 'sara' }), 200);
    s.tick(500);
    s.tick(1300); // 1100 ms after the last message: expired
    s.tick(1400); // already gone: no second notice
    expect(seen).toEqual(['youssef', 'sara', null]);
    stop();
    s.accept(ok(), 2000);
    expect(seen).toHaveLength(3);
  });
  it('a "nobody" message is a change only when someone was there', () => {
    const s = new PresenceStore(1000, 100);
    const seen: unknown[] = [];
    s.subscribe((p) => seen.push(p.userId));
    s.accept(ok({ userId: null, place: null, rssi: null }), 0);
    s.accept(ok(), 10);
    s.accept(ok({ userId: null, place: null, rssi: null, demo: true }), 20);
    expect(seen).toEqual(['youssef', null]);
  });
});

describe('the server pushes context to every connected app', () => {
  let srv: Running;
  beforeAll(async () => {
    srv = await start(
      {
        ...loadConfig({}),
        provider: 'fake',
        wsPort: 0,
        tcpPort: 0,
        origins: ['http://localhost:5173'],
      },
      () => {},
    );
  });
  afterAll(async () => srv.close());
  const open = (origin = 'http://localhost:5173') =>
    new Promise<{ ws: WebSocket; msgs: unknown[] }>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${srv.wsPort}`, { origin });
      const msgs: unknown[] = [];
      ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
      ws.on('open', () => resolve({ ws, msgs }));
      ws.on('error', reject);
    });
  const tcp = (line: string) =>
    new Promise<void>((resolve) => {
      const s = net.createConnection(srv.tcpPort, '127.0.0.1');
      s.on('data', () => {
        s.end();
        resolve();
      });
      s.write(line + '\n');
    });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('a presence sent over TCP reaches an app on the WebSocket; a late app gets the current one at once', async () => {
    const early = await open();
    await tcp(msg({ id: 'a', userId: 'sara', place: 'Shop', demo: true }));
    await wait(100);
    expect(early.msgs).toEqual([{ type: 'context', userId: 'sara', place: 'Shop', demo: true }]);
    const late = await open();
    await wait(100);
    expect(late.msgs).toEqual([{ type: 'context', userId: 'sara', place: 'Shop', demo: true }]);
    await tcp(msg({ id: 'b', userId: null, place: null, rssi: null }));
    await wait(100);
    expect(early.msgs.at(-1)).toEqual({ type: 'context', userId: null, place: null, demo: false });
    expect(late.msgs.at(-1)).toEqual({ type: 'context', userId: null, place: null, demo: false });
    early.ws.close();
    late.ws.close();
  });
  it('an app from an origin that is not allowed hears nothing', async () => {
    await expect(open('http://evil.example')).rejects.toThrow();
  });
});
