import type { PlaceName, SuggestRequest } from '../src/nlp/protocol.ts';

/** Anything that can propose a sentence for a list of words. The service validates whatever it returns. */
export interface SentenceProvider {
  readonly id: string;
  propose(req: SuggestRequest, signal: AbortSignal): Promise<string>;
}

const PLACE_HINT: Record<PlaceName, string> = {
  Clinic: 'a clinic or hospital',
  Shop: 'a shop',
  Work: 'a workplace',
  Home: 'at home',
};

export const SYSTEM_PROMPT = [
  'You turn a short list of words into ONE natural, polite English sentence for a person who communicates with picture cards and hand signs.',
  'Rules, all of them strict:',
  '- Use every word you are given. Keep their meaning.',
  '- Do NOT add facts: no names, numbers, times, places, symptoms, medicines, reasons or other new content words.',
  '- You may add only small helper words (a, the, I, my, please, need, want, can, could, would, excuse me, thank you).',
  '- Do not make it negative unless a given word is negative.',
  '- One sentence, at most 15 words. Plain text, no quotes, no explanation.',
].join('\n');

/** ArSL: the words are Arabic. Same strictness; the answer is Arabic and keeps every word exactly as written. */
export const SYSTEM_PROMPT_ARABIC = [
  'You turn a short list of Arabic words into ONE short, polite Arabic sentence for a person who communicates with hand signs.',
  'Rules, all of them strict:',
  '- Use every word you are given, exactly as written (do not change its letters).',
  '- Do NOT add facts: no names, numbers, times, places, symptoms, medicines, reasons or other new content words.',
  '- Only Arabic letters and punctuation. One sentence, at most 15 words. Plain text, no quotes, no explanation.',
].join('\n');

export function buildUserPrompt(req: SuggestRequest): string {
  const lines = [`Place: ${PLACE_HINT[req.place]}`, `Words: ${req.words.join(', ')}`];
  if (req.avoid && req.avoid.length)
    lines.push(`Give a different wording from: ${req.avoid.map((a) => `"${a}"`).join('; ')}`);
  lines.push('Sentence:');
  return lines.join('\n');
}

export type Fetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/** Claude through the Messages API. The key lives only in this process. */
export class AnthropicProvider implements SentenceProvider {
  readonly id = 'anthropic';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly doFetch: Fetch;
  constructor(apiKey: string, model: string, doFetch: Fetch = fetch as unknown as Fetch) {
    this.apiKey = apiKey;
    this.model = model;
    this.doFetch = doFetch;
  }
  async propose(req: SuggestRequest, signal: AbortSignal): Promise<string> {
    const res = await this.doFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 100,
        temperature: req.attempt > 0 ? 0.9 : 0.4,
        system: req.alphabet === 'arsl' ? SYSTEM_PROMPT_ARABIC : SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(req) }],
      }),
      signal,
    });
    if (!res.ok) throw new Error(`language model answered HTTP ${res.status}`);
    const body = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const text = body.content?.find((c) => c.type === 'text')?.text;
    if (typeof text !== 'string') throw new Error('language model sent no text');
    return text.trim().replace(/^["“]|["”]$/g, '');
  }
}

/** Deterministic stand-in for tests and demos (--provider fake). Not a language model. */
export class FakeProvider implements SentenceProvider {
  readonly id = 'fake';
  async propose(req: SuggestRequest): Promise<string> {
    const w = req.words.map((x) => x.toLowerCase());
    const joined = w.length > 1 ? `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}` : w[0];
    return req.attempt % 2 === 0 ? `I need ${joined}, please.` : `Excuse me, I need ${joined}.`;
  }
}
