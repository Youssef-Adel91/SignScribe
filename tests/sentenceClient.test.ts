import { describe, expect, it } from 'vitest';
import { WsSentenceClient, resolveSentenceUrl } from '../src/nlp/sentenceClient';
import { signScribeMachine } from '../src/state/machine';
import { createActor } from 'xstate';
import { PATH_TO_SCREEN } from '../src/state/paths';

describe('which server address is accepted', () => {
  it('none by default: the app stays offline', () =>
    expect(resolveSentenceUrl('', undefined)).toBeNull());
  it('the build address is trusted', () =>
    expect(resolveSentenceUrl('', 'wss://sentences.example/ws')).toBe(
      'wss://sentences.example/ws',
    ));
  it('a ?server= address is accepted only for this computer', () => {
    expect(resolveSentenceUrl('?server=ws://localhost:8787', undefined)).toBe(
      'ws://localhost:8787/',
    );
    expect(resolveSentenceUrl('?server=ws://127.0.0.1:9', undefined)).toBe('ws://127.0.0.1:9/');
    expect(resolveSentenceUrl('?server=ws://evil.example/ws', undefined)).toBeNull();
    expect(resolveSentenceUrl('?server=http://localhost:8787', undefined)).toBeNull();
    expect(resolveSentenceUrl('?server=ws://localhost.evil.example', undefined)).toBeNull();
    expect(resolveSentenceUrl('?server=not a url', undefined)).toBeNull();
  });
  it('a build address that is not ws(s) is ignored', () =>
    expect(resolveSentenceUrl('', 'http://x')).toBeNull());
});

/** a fake WebSocket that answers like the server */
class FakeWs {
  static last: FakeWs | null = null;
  static mode: 'ok' | 'silent' | 'refuse' | 'error' = 'ok';
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeWs.last = this;
    setTimeout(() => {
      if (FakeWs.mode === 'refuse') return this.onerror?.();
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }
  send(d: string) {
    this.sent.push(d);
    if (FakeWs.mode === 'silent') return;
    const r = JSON.parse(d);
    const out =
      FakeWs.mode === 'error'
        ? { id: r.id, ok: false, error: 'bad_request', message: 'nope' }
        : {
            id: r.id,
            ok: true,
            type: 'suggest',
            sentence: 'I need a doctor, please.',
            source: 'llm',
          };
    setTimeout(() => this.onmessage?.({ data: JSON.stringify(out) }), 0);
  }
  close() {
    this.readyState = 3;
  }
}

describe('WsSentenceClient', () => {
  const make = (t = 100) => new WsSentenceClient('ws://localhost:8787', t, FakeWs as never);
  it('sends a request in the documented format and returns the sentence', async () => {
    FakeWs.mode = 'ok';
    const c = make();
    const r = await c.suggest(['DOCTOR'], 'Clinic', 1, ['a', 'b', 'c', 'd']);
    expect(r).toMatchObject({ sentence: 'I need a doctor, please.', source: 'llm' });
    const sent = JSON.parse(FakeWs.last!.sent[0]);
    expect(sent).toMatchObject({
      type: 'suggest',
      words: ['DOCTOR'],
      place: 'Clinic',
      attempt: 1,
      avoid: ['b', 'c', 'd'],
    });
  });
  it('rejects when the server is unreachable, silent or answers with an error', async () => {
    FakeWs.mode = 'refuse';
    await expect(make().suggest(['A'], 'Clinic', 0, [])).rejects.toThrow(/not reachable/);
    FakeWs.mode = 'silent';
    await expect(make(30).suggest(['A'], 'Clinic', 0, [])).rejects.toThrow(/too slow/);
    FakeWs.mode = 'error';
    await expect(make().suggest(['A'], 'Clinic', 0, [])).rejects.toThrow(/nope/);
  });
  it('matches answers to requests by id when two are in flight', async () => {
    FakeWs.mode = 'ok';
    const c = make();
    const [a, b] = await Promise.all([
      c.suggest(['A'], 'Clinic', 0, []),
      c.suggest(['B'], 'Clinic', 0, []),
    ]);
    expect(a.sentence).toBe(b.sentence);
    expect(FakeWs.last!.sent).toHaveLength(2);
  });
});

describe('the machine only accepts a server sentence that fits', () => {
  const review = () => {
    const a = createActor(signScribeMachine);
    a.start();
    for (const e of PATH_TO_SCREEN[11]) a.send(e);
    return a;
  };
  const ev = (a: ReturnType<typeof review>, over: Record<string, unknown> = {}) => {
    const c = a.getSnapshot().context;
    a.send({
      type: 'SENTENCE_SERVER',
      sentence: 'Hello, I need a doctor, please.',
      words: c.words,
      attempt: c.sentenceAttempt,
      ...over,
    } as never);
    return a.getSnapshot().context;
  };
  it('accepts a good sentence for the current words and attempt', () => {
    const c = ev(review());
    expect(c.sentence).toBe('Hello, I need a doctor, please.');
    expect(c.sentenceSource).toBe('server');
  });
  it('ignores an answer for an old attempt or other words', () => {
    const a = review();
    expect(ev(a, { attempt: 5 }).sentenceSource).toBe('offline');
    expect(ev(a, { words: ['OTHER'] }).sentenceSource).toBe('offline');
  });
  it('ignores a sentence that breaks the safety rule, even from a trusted server', () => {
    const a = review();
    expect(ev(a, { sentence: 'Hello, I need a doctor for my headache.' }).sentenceSource).toBe(
      'offline',
    );
    expect(ev(a, { sentence: 'Hello doctor.' }).sentenceSource).toBe('offline'); // drops need / I
    expect(ev(a, { sentence: '' }).sentence).not.toBe('');
  });
  it('ignores an answer after the sentence was confirmed, or when it is not the review screen', () => {
    const a = review();
    a.send({ type: 'YES' });
    const before = a.getSnapshot().context.sentence;
    expect(ev(a).sentence).toBe(before);
    const b = createActor(signScribeMachine);
    b.start();
    b.send({ type: 'SENTENCE_SERVER', sentence: 'Hi.', words: [], attempt: 0 });
    expect(b.getSnapshot().context.sentenceSource).toBe('offline');
  });
  it('"try another" goes back to the offline sentence until a new answer arrives', () => {
    const a = review();
    ev(a);
    a.send({ type: 'NO' });
    const c = a.getSnapshot().context;
    expect(c.sentenceSource).toBe('offline');
    expect(c.sentenceAttempt).toBe(1);
  });
});
