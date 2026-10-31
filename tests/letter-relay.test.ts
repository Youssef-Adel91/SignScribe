// @vitest-environment node
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createActor, getNextSnapshot } from 'xstate';
import { parseLetterPush, parseRequest, type LetterRequest } from '../src/nlp/protocol';
import { loadConfig } from '../server/config';
import { RateLimiter, handleMessage } from '../server/handler';
import { LetterRelay } from '../server/letters';
import { start, type Running } from '../server/index';
import { SentenceService } from '../server/sentences';
import { signScribeMachine, screenOf, type Ev } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';

const msg = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: 'l1',
    type: 'letter',
    letter: 'J',
    score: 0.83,
    source: 'dollarpy',
    demo: false,
    ...over,
  });

describe('letter message (dollarpy client -> server)', () => {
  it('accepts one letter of any script with a score and a source', () => {
    const p = parseRequest(msg());
    expect(p.ok && p.msg).toEqual({
      id: 'l1',
      type: 'letter',
      letter: 'J',
      score: 0.83,
      source: 'dollarpy',
      demo: false,
    });
    expect(parseRequest(msg({ letter: 'ع', demo: true })).ok).toBe(true);
    expect(parseRequest(msg({ demo: undefined })).ok).toBe(true);
  });
  it.each([
    ['two letters', { letter: 'JZ' }, /exactly one letter/],
    ['a digit', { letter: '7' }, /exactly one letter/],
    ['a space', { letter: ' ' }, /exactly one letter/],
    ['no letter', { letter: undefined }, /letter/],
    ['a score above 1', { score: 1.2 }, /score/],
    ['a negative score', { score: -0.1 }, /score/],
    ['a score as text', { score: '0.8' }, /score/],
    ['an infinite score', { score: null }, /score/],
    ['a source with capitals', { source: 'DollarPy' }, /source/],
    ['a source that is too long', { source: 'a'.repeat(30) }, /source/],
    ['an extra field', { words: ['x'] }, /unknown field/],
    ['demo as text', { demo: 'yes' }, /demo/],
  ])('refuses %s', (_n, over, re) => {
    const p = parseRequest(msg(over));
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toMatch(re);
  });
  it('the pushed form is checked again in the browser', () => {
    const ok = JSON.stringify({
      type: 'letter',
      letter: 'Z',
      score: 0.7,
      source: 'dollarpy',
      demo: true,
    });
    expect(parseLetterPush(ok)).toEqual({
      type: 'letter',
      letter: 'Z',
      score: 0.7,
      source: 'dollarpy',
      demo: true,
    });
    for (const bad of [
      '{nope',
      '[]',
      '{"type":"context"}',
      JSON.stringify({ type: 'letter', letter: 'ZZ', score: 1, source: 'dollarpy' }),
    ])
      expect(parseLetterPush(bad)).toBeNull();
  });
});

const letter = (over: Partial<LetterRequest> = {}): LetterRequest => ({
  id: 'x',
  type: 'letter',
  letter: 'J',
  score: 0.9,
  source: 'dollarpy',
  demo: false,
  ...over,
});

describe('LetterRelay', () => {
  it('passes letters on, stores nothing, and has its own rate limit', () => {
    const r = new LetterRelay(2);
    const got: string[] = [];
    const stop = r.subscribe((l) => got.push(l.letter));
    expect([
      r.accept(letter(), 0),
      r.accept(letter({ letter: 'Z' }), 1),
      r.accept(letter(), 2),
    ]).toEqual([true, true, false]);
    expect(got).toEqual(['J', 'Z']);
    expect(r.relayed).toBe(2);
    stop();
    expect(r.accept(letter(), 10_001)).toBe(true);
    expect(got).toHaveLength(2);
  });
  it('handler: acknowledges, answers rate_limited, refuses when letters are off', async () => {
    const svc = new SentenceService({ provider: null, timeoutMs: 50 });
    const letters = new LetterRelay(1);
    expect(await handleMessage(msg(), svc, new RateLimiter(9), 0, { letters })).toEqual({
      id: 'l1',
      ok: true,
      type: 'letter',
    });
    expect(await handleMessage(msg(), svc, new RateLimiter(9), 1, { letters })).toMatchObject({
      ok: false,
      error: 'rate_limited',
    });
    expect(await handleMessage(msg(), svc, new RateLimiter(9))).toMatchObject({
      ok: false,
      error: 'bad_request',
    });
  });
});

describe('letters through the real server', () => {
  let srv: Running;
  const log: string[] = [];
  beforeAll(async () => {
    srv = await start(
      {
        ...loadConfig({}),
        provider: 'fake',
        wsPort: 0,
        tcpPort: 0,
        origins: ['http://localhost:5173'],
        letterRateLimit: 3,
      },
      (l) => log.push(l),
    );
  });
  afterAll(async () => srv.close());
  const tcp = (payload: string, n: number) =>
    new Promise<unknown[]>((resolve, reject) => {
      const out: unknown[] = [];
      const s = net.createConnection(srv.tcpPort, '127.0.0.1');
      let buf = '';
      s.setEncoding('utf8');
      s.on('data', (d: string) => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          out.push(JSON.parse(buf.slice(0, i)));
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
  it('a letter sent over TCP reaches the app on the WebSocket, is not replayed to a late app, and is never logged', async () => {
    const msgs: unknown[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${srv.wsPort}`, { origin: 'http://localhost:5173' });
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    await new Promise((r) => ws.on('open', r));
    const [ack] = (await tcp(msg({ letter: 'Z' }) + '\n', 1)) as { ok: boolean }[];
    expect(ack.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(msgs).toEqual([
      { type: 'letter', letter: 'Z', score: 0.83, source: 'dollarpy', demo: false },
    ]);
    const late: unknown[] = [];
    const ws2 = new WebSocket(`ws://127.0.0.1:${srv.wsPort}`, { origin: 'http://localhost:5173' });
    ws2.on('message', (d) => late.push(JSON.parse(d.toString())));
    await new Promise((r) => ws2.on('open', r));
    await new Promise((r) => setTimeout(r, 100));
    expect(late).toEqual([]);
    expect(log.join('\n')).not.toMatch(/\bZ\b.*dollarpy|letter Z/);
    ws.close();
    ws2.close();
  });
  it('the letter limit applies to everyone together', async () => {
    const lines = Array.from({ length: 5 }, (_, i) => msg({ id: `m${i}` })).join('\n') + '\n';
    const r = (await tcp(lines, 5)) as { ok: boolean; error?: string }[];
    expect(r.filter((x) => x.error === 'rate_limited').length).toBeGreaterThanOrEqual(2);
  });
});

describe('a letter that reached no app is held briefly for the next one (KNOWN_ISSUES #24)', () => {
  const req = {
    type: 'letter',
    id: 'x',
    letter: 'J',
    score: 0.8,
    source: 'dollarpy',
  } as LetterRequest;
  it('is handed once to the next app, only while fresh', () => {
    const lines: string[] = [];
    const r = new LetterRelay(10, 5000, (l) => lines.push(l));
    r.subscribe(() => 0); // an app listener that sent it to nobody
    expect(r.accept(req, 1000)).toBe(true);
    expect(r.takeHeld(3000)).toMatchObject({ type: 'letter', letter: 'J' });
    expect(r.takeHeld(3000)).toBeNull(); // once
    r.accept(req, 10_000);
    expect(r.takeHeld(15_001)).toBeNull(); // older than the hold time
    expect(lines.join('\n')).toMatch(
      /letter #1 received; sent to 0 WebSocket clients; held 5000 ms/,
    );
    expect(lines.join('\n')).not.toMatch(/\bJ\b/); // counts only, never the letter
  });
  it('is not held when an app received it, or when holding is off', () => {
    const got = new LetterRelay(10, 5000);
    got.subscribe(() => 1);
    got.accept(req, 1000);
    expect(got.takeHeld(1500)).toBeNull();
    const off = new LetterRelay(10, 0);
    off.subscribe(() => 0);
    off.accept(req, 1000);
    expect(off.takeHeld(1001)).toBeNull();
  });
  it('a refused (rate limited) letter is not held and is counted in the log', () => {
    const lines: string[] = [];
    const r = new LetterRelay(1, 5000, (l) => lines.push(l));
    r.subscribe(() => 0);
    expect(r.accept(req, 1000)).toBe(true);
    r.takeHeld(1001);
    expect(r.accept(req, 1002)).toBe(false);
    expect(r.takeHeld(1003)).toBeNull();
    expect(lines.join('\n')).toMatch(/over the letter limit \(1 refused so far\)/);
  });
});

describe('the late-app rule through the real server', () => {
  let srv: Running;
  const log: string[] = [];
  beforeAll(async () => {
    srv = await start(
      {
        ...loadConfig({}),
        provider: 'fake',
        wsPort: 0,
        tcpPort: 0,
        origins: ['http://localhost:5173'],
      },
      (l) => log.push(l),
    );
  });
  afterAll(async () => srv.close());
  const sendTcp = (line: string) =>
    new Promise<void>((resolve, reject) => {
      const s = net.createConnection(srv.tcpPort, '127.0.0.1');
      s.setEncoding('utf8');
      s.on('data', () => {
        s.end();
        resolve();
      });
      s.on('error', reject);
      s.write(line + '\n');
    });
  const connect = async () => {
    const got: unknown[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${srv.wsPort}`, { origin: 'http://localhost:5173' });
    ws.on('message', (d) => got.push(JSON.parse(d.toString())));
    await new Promise((r) => ws.on('open', r));
    await new Promise((r) => setTimeout(r, 100));
    return { ws, got };
  };
  const health = async () =>
    (await (await fetch(`http://127.0.0.1:${srv.wsPort}/health`)).json()) as {
      webSocketClients: number;
      lettersRelayed: number;
    };

  it('a letter sent before any app connected reaches the first app that connects, once, and is not logged', async () => {
    expect((await health()).webSocketClients).toBe(0);
    await sendTcp(msg({ id: 'early', letter: 'Q' }));
    const first = await connect();
    expect(first.got).toEqual([
      { type: 'letter', letter: 'Q', score: 0.83, source: 'dollarpy', demo: false },
    ]);
    const second = await connect(); // a second app does not get it again
    expect(second.got).toEqual([]);
    const h = await health();
    expect(h.webSocketClients).toBe(2);
    expect(h.lettersRelayed).toBe(1);
    const text = log.join('\n');
    expect(text).toMatch(/letter #1 received; sent to 0 WebSocket clients; held/);
    expect(text).toMatch(/handed to an app that connected/);
    expect(text).not.toMatch(/\bQ\b/);
    first.ws.close();
    second.ws.close();
  });
  it('a letter that was delivered is not replayed to an app that connects later', async () => {
    const a = await connect();
    await sendTcp(msg({ id: 'seen', letter: 'W' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(a.got).toHaveLength(1);
    expect(log.join('\n')).toMatch(/sent to 1 WebSocket client(?!s)/);
    const b = await connect();
    expect(b.got).toEqual([]);
    a.ws.close();
    b.ws.close();
  });
});

describe('LETTER_ADD in the state machine', () => {
  const send = (...e: Ev[]) => {
    const a = createActor(signScribeMachine);
    a.start();
    return e.reduce((s, ev) => getNextSnapshot(signScribeMachine, s, ev), a.getSnapshot());
  };
  it('adds the letter to the word on the spelling screens', () => {
    const s = send(
      ...PATH_TO_SCREEN[6],
      { type: 'LETTER_ADD', letter: 'j' },
      { type: 'LETTER_ADD', letter: 'Z' },
    );
    expect(s.context.word).toBe('JZ');
    expect(screenOf(s.value, s.context)).toBe(6);
  });
  it('does nothing anywhere else, or while an overlay is open', () => {
    for (const n of [1, 4, 10, 11, 12])
      expect(send(...PATH_TO_SCREEN[n], { type: 'LETTER_ADD', letter: 'J' }).context.word).toBe('');
    expect(
      send(...PATH_TO_SCREEN[6], { type: 'HELP_TOGGLE' }, { type: 'LETTER_ADD', letter: 'J' })
        .context.word,
    ).toBe('');
  });
});
