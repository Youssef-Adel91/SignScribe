/**
 * The safety rule for every suggested sentence, whoever wrote it (offline rules, the language model,
 * the server). It is checked on the server AND again in the browser, so a bad answer never reaches the
 * person even if the server is wrong or has been tampered with.
 *
 *   1. every word the person chose is in the sentence (simple endings like -s, -ed, -ing are fine)
 *   2. nothing else is added except small function words (articles, pronouns, "please", "need", ...):
 *      no new nouns, names, numbers, times, places, negations or other facts
 *   3. short, one or two sentences, plain letters and punctuation, no links
 *
 * This file must stay free of imports and of syntax Node's type stripping cannot run (no enums, no
 * constructor parameter properties): the Node server imports it directly.
 */
export type Validation = { ok: true } | { ok: false; reason: string };

export const MAX_SENTENCE_CHARS = 200;
export const MAX_SENTENCE_WORDS = 25;

/** words that may appear without being chosen. Deliberately small: every entry is a judgement call. */
export const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'i',
  'me',
  'my',
  'we',
  'us',
  'our',
  'you',
  'your',
  'it',
  'this',
  'that',
  'these',
  'those',
  'is',
  'are',
  'am',
  'be',
  'do',
  'does',
  'can',
  'could',
  'would',
  'will',
  'may',
  'might',
  'should',
  'have',
  'has',
  'to',
  'of',
  'for',
  'in',
  'on',
  'at',
  'with',
  'and',
  'or',
  'but',
  'so',
  'if',
  'some',
  'any',
  'here',
  'there',
  'now',
  'please',
  'hello',
  'hi',
  'thanks',
  'thank',
  'excuse',
  'sorry',
  'need',
  'want',
  'like',
  'get',
  'how',
  'what',
  'where',
  'when',
  'who',
  'much',
  'many',
  'very',
  'too',
  'also',
  'little',
  'bit',
]);

const ENDINGS = ['', 's', 'es', 'ed', 'd', 'ing', "'s"];

const tokens = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[’]/g, "'")
    .match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];

/** is `token` the chosen word `w`, possibly with an ending (need, needs, needed, needing)? */
export function sameWord(token: string, w: string): boolean {
  if (token === w) return true;
  if (ENDINGS.some((e) => token === w + e)) return true;
  // drop a final e before -ing / -ed (breathe -> breathing), and double a final consonant (stop -> stopped)
  if (w.endsWith('e') && (token === w.slice(0, -1) + 'ing' || token === w.slice(0, -1) + 'ed'))
    return true;
  const last = w[w.length - 1];
  return w.length > 2 && (token === w + last + 'ed' || token === w + last + 'ing');
}

export function validateSentence(chosen: readonly string[], sentence: string): Validation {
  const text = sentence.trim();
  if (!text) return { ok: false, reason: 'empty' };
  if (text.length > MAX_SENTENCE_CHARS) return { ok: false, reason: 'too long' };
  if (!/^[A-Za-z0-9 .,!?'’;:-]+$/.test(text)) return { ok: false, reason: 'unexpected characters' };
  if (/https?|www\.|@/i.test(text)) return { ok: false, reason: 'contains a link' };
  const toks = tokens(text);
  if (toks.length === 0) return { ok: false, reason: 'no words' };
  if (toks.length > MAX_SENTENCE_WORDS) return { ok: false, reason: 'too many words' };
  if ((text.match(/[.!?](\s|$)/g) ?? []).length > 2)
    return { ok: false, reason: 'more than two sentences' };

  const wanted = chosen.flatMap((c) => tokens(c));
  const missing = wanted.filter((w) => !toks.some((t) => sameWord(t, w)));
  if (missing.length) return { ok: false, reason: `missing word: ${missing[0]}` };

  const extra = toks.filter((t) => !FUNCTION_WORDS.has(t) && !wanted.some((w) => sameWord(t, w)));
  if (extra.length) return { ok: false, reason: `added word: ${extra[0]}` };
  return { ok: true };
}
