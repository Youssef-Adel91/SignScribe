// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RateLimiter, handleMessage } from '../server/handler';
import { SYSTEM_PROMPT, SYSTEM_PROMPT_ARABIC, type SentenceProvider } from '../server/llm';
import { SentenceService } from '../server/sentences';

const provider = (answer: string): SentenceProvider => ({
  id: 'fake',
  propose: async () => answer,
});
const req = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    id: 'a1',
    type: 'suggest',
    words: ['طبيب', 'ماء'],
    place: 'Clinic',
    attempt: 0,
    alphabet: 'arsl',
    ...over,
  });
const run = (answer: string | null, text = req()) =>
  handleMessage(
    text,
    new SentenceService({ provider: answer === null ? null : provider(answer), timeoutMs: 1000 }),
    new RateLimiter(100),
  );

describe('sentence server with ArSL', () => {
  it('accepts an Arabic answer that has the chosen words and the limits', async () => {
    const r = await run('أحتاج طبيب وماء من فضلك. طبيب ماء');
    expect(r).toMatchObject({ ok: true, source: 'llm' });
  });
  it('falls back to the words as they are when the model answers in English', async () => {
    const r = await run('I need a doctor and water');
    expect(r).toMatchObject({ ok: true, source: 'offline', sentence: 'طبيب ماء' });
  });
  it.each([
    ['a missing chosen word', 'طبيب فقط'],
    ['a link', 'طبيب ماء https://x.com'],
    ['a digit', 'طبيب ماء 5'],
    ['too long', `طبيب ماء ${'ا'.repeat(250)}`],
    ['too many words', `طبيب ماء ${Array(30).fill('كلمة').join(' ')}`],
  ])('still rejects %s', async (_n, answer) => {
    const r = await run(answer);
    expect(r).toMatchObject({ ok: true, source: 'offline' });
  });
  it('without a model it answers with the words, nothing added', async () => {
    expect(await run(null)).toMatchObject({ source: 'offline', sentence: 'طبيب ماء' });
  });
  it('the rate limit counts ArSL requests like any other', async () => {
    const limiter = new RateLimiter(2);
    const svc = new SentenceService({ provider: null, timeoutMs: 1000 });
    const a = await handleMessage(req(), svc, limiter, 1000);
    const b = await handleMessage(req(), svc, limiter, 1001);
    const c = await handleMessage(req(), svc, limiter, 1002);
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, false]);
    expect(c).toMatchObject({ ok: false, error: 'rate_limited' });
  });
  it('Latin words are refused when the request says ArSL, and Arabic ones when it does not', async () => {
    expect(await run(null, req({ words: ['doctor'] }))).toMatchObject({
      ok: false,
      error: 'bad_request',
    });
    expect(await run(null, req({ alphabet: undefined }))).toMatchObject({
      ok: false,
      error: 'bad_request',
    });
  });
  it('the Arabic prompt asks for exact words and no new facts', () => {
    expect(SYSTEM_PROMPT_ARABIC).toMatch(/exactly as written/);
    expect(SYSTEM_PROMPT_ARABIC).toMatch(/Do NOT add facts/);
    expect(SYSTEM_PROMPT_ARABIC).not.toBe(SYSTEM_PROMPT);
  });
});
