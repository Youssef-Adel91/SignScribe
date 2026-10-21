// @vitest-environment node
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { LIMITS, parseRequest, type ServerMessage } from '../src/nlp/protocol';
import { loadConfig } from '../server/config';
import { RateLimiter, handleMessage } from '../server/handler';
import { start, type Running } from '../server/index';
import {
  AnthropicProvider,
  FakeProvider,
  buildUserPrompt,
  type Fetch,
  type SentenceProvider,
} from '../server/llm';
import { SentenceService } from '../server/sentences';

const req = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: 'r1',
    type: 'suggest',
    words: ['DOCTOR', 'HELP'],
    place: 'Clinic',
    attempt: 0,
    ...over,
  });

describe('protocol parsing', () => {
  it('accepts a good request and trims the words', () => {
    const p = parseRequest(req({ words: [' doctor ', 'Help'] }));
    expect(p.ok && p.msg.type === 'suggest' && p.msg.words).toEqual(['doctor', 'Help']);
  });
  it.each([
    ['not JSON', '{nope', /not valid JSON/],
    ['an array', '[]', /JSON object/],
    ['no id', JSON.stringify({ type: 'ping' }), /'id'/],
    ['long id', JSON.stringify({ id: 'x'.repeat(65), type: 'ping' }), /'id'/],
    ['unknown type', JSON.stringify({ id: '1', type: 'run' }), /'type'/],
    ['no words', req({ words: [] }), /'words'/],
    ['too many words', req({ words: Array(LIMITS.maxWords + 1).fill('HELP') }), /'words'/],
    ['digits in a word', req({ words: ['DOC7OR'] }), /letters only/],
    ['a non-string word', req({ words: [5] }), /letters only/],
    ['bad place', req({ place: 'Moon' }), /'place'/],
    ['bad attempt', req({ attempt: -1 }), /'attempt'/],
    ['float attempt', req({ attempt: 1.5 }), /'attempt'/],
    ['avoid not an array', req({ avoid: 'x' }), /'avoid'/],
    ['avoid too long', req({ avoid: ['x'.repeat(LIMITS.maxAvoidChars + 1)] }), /'avoid'/],
  ])('refuses %s with a reason', (_n, text, re) => {
    const p = parseRequest(text as string);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toMatch(re as RegExp);
  });
  it('refuses a message over the size limit', () => {
    const p = parseRequest(
      req({ avoid: ['x'.repeat(190), 'y'.repeat(190)], pad: 'z'.repeat(LIMITS.maxMessage) }),
    );
    expect(p.ok).toBe(false);
  });
});

/** a provider that returns what the test says */
const says = (text: string | Error, delayMs = 0): SentenceProvider => ({
  id: 'test',
  propose: (_r, signal) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => (text instanceof Error ? reject(text) : resolve(text)), delayMs);
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      });
    }),
});
const service = (p: SentenceProvider | null, timeoutMs = 200) =>
  new SentenceService({ provider: p, timeoutMs });
const ask = (s: SentenceService, over: Record<string, unknown> = {}) =>
  handleMessage(req(over), s, new RateLimiter(100));

describe('SentenceService', () => {
  it('uses a valid language-model sentence and says so', async () => {
    const r = (await ask(service(says('I need a doctor, please help.')))) as {
      source: string;
      sentence: string;
    };
    expect(r).toMatchObject({ ok: true, source: 'llm', sentence: 'I need a doctor, please help.' });
  });
  it('falls back to the offline rules when the sentence adds a fact, with the reason', async () => {
    const r = (await ask(service(says('I need a doctor for my headache.')), {
      words: ['DOCTOR'],
    })) as {
      source: string;
      note: string;
      sentence: string;
    };
    expect(r.source).toBe('offline');
    expect(r.note).toMatch(/rejected.*added word: headache/);
    expect(r.sentence).not.toMatch(/headache/);
  });
  it('falls back when a chosen word is dropped', async () => {
    const r = (await ask(service(says('I need a doctor.')))) as { source: string; note: string };
    expect(r.source).toBe('offline');
    expect(r.note).toMatch(/missing word: help/);
  });
  it('falls back when the model is too slow, fails, or is not configured', async () => {
    expect(((await ask(service(says('Doctor help.', 1000), 50))) as { note: string }).note).toMatch(
      /too slow/,
    );
    expect(((await ask(service(says(new Error('boom'))))) as { note: string }).note).toMatch(
      /unavailable/,
    );
    expect(((await ask(service(null))) as { note: string }).note).toMatch(/no language model/);
  });
  it('does not repeat a sentence the person has already seen', async () => {
    const r = (await ask(service(says('Doctor help.')), { avoid: ['doctor help.'] })) as {
      source: string;
      note: string;
    };
    expect(r.source).toBe('offline');
    expect(r.note).toMatch(/repeated/);
  });
  it('the offline answer always passes the safety rule', async () => {
    for (let a = 0; a < 5; a++) {
      const r = (await ask(service(null), { attempt: a })) as { sentence: string };
      expect(r.sentence).toMatch(/doctor/i);
    }
  });
  it('never logs the words of the person', async () => {
    const lines: string[] = [];
    const s = new SentenceService({
      provider: says('I need a doctor for my headache.'),
      timeoutMs: 100,
      log: (l) => lines.push(l),
    });
    await ask(s, { words: ['DOCTOR'] });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join(' ')).not.toMatch(/doctor|help/i);
  });
});

describe('handler', () => {
  it('answers ping, bad input, and rate limits', async () => {
    const s = service(null);
    const lim = new RateLimiter(2);
    expect(await handleMessage(JSON.stringify({ id: 'p', type: 'ping' }), s, lim, 0)).toEqual({
      id: 'p',
      ok: true,
      type: 'pong',
    });
    expect(await handleMessage('garbage', s, lim, 1)).toMatchObject({
      ok: false,
      error: 'bad_request',
    });
    expect(await handleMessage(req(), s, lim, 2)).toMatchObject({
      ok: false,
      error: 'rate_limited',
      id: 'r1',
    });
    expect(await handleMessage(req(), s, lim, 10_500)).toMatchObject({ ok: true }); // a new window
  });
  it('too large messages get their own error', async () => {
    const r = await handleMessage(
      'x'.repeat(LIMITS.maxMessage + 1),
      service(null),
      new RateLimiter(5),
    );
    expect(r).toMatchObject({ ok: false, error: 'too_large' });
  });
});

describe('AnthropicProvider (fake HTTP)', () => {
  const sent: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] =
    [];
  const f =
    (status: number, json: unknown): Fetch =>
    async (url, init) => {
      sent.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return { ok: status < 400, status, json: async () => json };
    };
  const r = {
    id: '1',
    type: 'suggest' as const,
    words: ['DOCTOR', 'HELP'],
    place: 'Clinic' as const,
    attempt: 1,
    avoid: ['Doctor help.'],
  };
  it('sends the key only in the header, a strict system prompt, and the words', async () => {
    const p = new AnthropicProvider(
      'sk-test',
      'claude-haiku-5-5',
      f(200, { content: [{ type: 'text', text: '"I need a doctor, please help."' }] }),
    );
    expect(await p.propose(r, new AbortController().signal)).toBe('I need a doctor, please help.');
    const call = sent[0];
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    expect(call.headers['x-api-key']).toBe('sk-test');
    expect(JSON.stringify(call.body)).not.toContain('sk-test');
    expect(String(call.body.system)).toMatch(/Do NOT add facts/);
    expect(JSON.stringify(call.body.messages)).toContain('DOCTOR, HELP');
    expect(JSON.stringify(call.body.messages)).toContain('Doctor help.'); // avoid
    expect(call.body.model).toBe('claude-haiku-5-5');
  });
  it('turns an HTTP error or a reply without text into an error (so the service falls back)', async () => {
    await expect(
      new AnthropicProvider('k', 'm', f(500, {})).propose(r, new AbortController().signal),
    ).rejects.toThrow(/HTTP 500/);
    await expect(
      new AnthropicProvider('k', 'm', f(200, { content: [] })).propose(
        r,
        new AbortController().signal,
      ),
    ).rejects.toThrow(/no text/);
  });
  it('builds a prompt with place and words', () =>
    expect(buildUserPrompt({ ...r, avoid: undefined })).toMatch(/clinic[\s\S]*DOCTOR, HELP/i));
});

describe('config', () => {
  it('uses the language model only when a key is set, and listens on localhost by default', () => {
    expect(loadConfig({}).provider).toBe('offline');
    expect(loadConfig({ ANTHROPIC_API_KEY: ' k ' }).provider).toBe('anthropic');
    expect(loadConfig({ SENTENCE_PROVIDER: 'fake' }).provider).toBe('fake');
    expect(loadConfig({}).host).toBe('127.0.0.1');
    expect(loadConfig({ WS_PORT: 'x' }).wsPort).toBe(8787);
  });
});

describe('server over a real WebSocket and a real TCP socket', () => {
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

  const wsAsk = (origin: string | undefined, text: string) =>
    new Promise<ServerMessage>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${srv.wsPort}`, origin ? { origin } : {});
      ws.on('open', () => ws.send(text));
      ws.on('message', (d) => {
        resolve(JSON.parse(d.toString()));
        ws.close();
      });
      ws.on('error', reject);
      ws.on('unexpected-response', (_q, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    });

  it('WebSocket: answers a request from an allowed origin', async () => {
    const r = await wsAsk('http://localhost:5173', req());
    expect(r).toMatchObject({
      id: 'r1',
      ok: true,
      source: 'llm',
      sentence: 'I need doctor and help, please.',
    });
  });
  it('WebSocket: refuses an origin that is not on the list, and a missing origin', async () => {
    await expect(wsAsk('http://evil.example', req())).rejects.toThrow(/403|HTTP/);
    await expect(wsAsk(undefined, req())).rejects.toThrow(/403|HTTP/);
  });
  it('WebSocket: refuses nonsense with a reason and survives it', async () => {
    expect(await wsAsk('http://localhost:5173', 'hello')).toMatchObject({
      ok: false,
      error: 'bad_request',
    });
    expect(
      await wsAsk('http://localhost:5173', JSON.stringify({ id: 'a', type: 'ping' })),
    ).toMatchObject({ ok: true, type: 'pong' });
  });
  it('TCP: one JSON line in, one JSON line out, several requests on one connection', async () => {
    const lines = await new Promise<ServerMessage[]>((resolve, reject) => {
      const out: ServerMessage[] = [];
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
        if (out.length === 3) {
          s.end();
          resolve(out);
        }
      });
      s.on('error', reject);
      s.write(
        req({ id: 'a' }) + '\n' + JSON.stringify({ id: 'b', type: 'ping' }) + '\n' + 'not json\n',
      );
    });
    const byId = Object.fromEntries(lines.map((l) => [l.id || 'none', l]));
    expect(byId.a).toMatchObject({ ok: true, type: 'suggest' });
    expect(byId.b).toMatchObject({ ok: true, type: 'pong' });
    expect(byId.none).toMatchObject({ ok: false, error: 'bad_request' });
  });
  it('the fake provider output satisfies the safety rule', async () => {
    const p = new FakeProvider();
    for (let a = 0; a < 2; a++) {
      const s = await p.propose({
        id: '1',
        type: 'suggest',
        words: ['DOCTOR', 'HELP'],
        place: 'Clinic',
        attempt: a,
      });
      expect(s).toMatch(/doctor/);
    }
  });
});
