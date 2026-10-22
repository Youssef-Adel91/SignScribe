import type { Fetch } from './llm.ts';

export type SelfTest =
  | { ok: true }
  | {
      ok: false;
      kind: 'model' | 'request' | 'auth' | 'limit' | 'server' | 'network';
      message: string;
    };

/**
 * One real request when the server starts with a key. A wrong model name, a bad key or a blocked
 * network must be a loud message at the start, not something found out later as "the language model
 * is never used" (every failure afterwards just falls back to the offline rules, quietly).
 */
export async function selfTest(
  apiKey: string,
  model: string,
  doFetch: Fetch = fetch as unknown as Fetch,
  timeoutMs = 8000,
): Promise<SelfTest> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await doFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'Reply with the word ok.' }],
      }),
      signal: ctl.signal,
    });
    if (res.ok) return { ok: true };
    const s = res.status;
    const detail = await res.json().then(
      (j) => (j as { error?: { message?: string } })?.error?.message ?? '',
      () => '',
    );
    const tail = detail ? ` (${detail.slice(0, 160)})` : '';
    if (s === 404)
      return {
        ok: false,
        kind: 'model',
        message: `HTTP 404: the model "${model}" was not found. Set SENTENCE_MODEL to a model id your key can use${tail}`,
      };
    if (s === 400)
      return {
        ok: false,
        kind: 'request',
        message: `HTTP 400: the API refused the request. Check SENTENCE_MODEL ("${model}") and the request format${tail}`,
      };
    if (s === 401 || s === 403)
      return {
        ok: false,
        kind: 'auth',
        message: `HTTP ${s}: the API key was refused. Check ANTHROPIC_API_KEY${tail}`,
      };
    if (s === 429)
      return { ok: false, kind: 'limit', message: `HTTP 429: rate limit or quota reached${tail}` };
    return { ok: false, kind: 'server', message: `HTTP ${s}: the API had a problem${tail}` };
  } catch (e) {
    const why = ctl.signal.aborted
      ? `no answer in ${timeoutMs / 1000} s`
      : e instanceof Error
        ? e.message
        : String(e);
    return { ok: false, kind: 'network', message: `could not reach api.anthropic.com: ${why}` };
  } finally {
    clearTimeout(timer);
  }
}
