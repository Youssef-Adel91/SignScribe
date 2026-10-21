import type { Place } from './words';

/**
 * PHASE 1 PLACEHOLDER. Deterministic offline template so the review/share screens have text.
 * Phase 6 replaces this with the LLM client + validation and keeps this as the fallback.
 * Rules: never add facts, keep every content word.
 */
export function offlineSentence(words: readonly string[], _place: Place, attempt: number): string {
  const lower = words.map((w) => w.toLowerCase());
  if (lower.length === 0) return '';
  const hello = lower[0] === 'hello';
  let rest = hello ? lower.slice(1) : lower;
  // "i need <noun>" -> "I need a <noun>"
  const iNeed = rest[0] === 'i' && rest[1] === 'need' && rest.length === 3;
  const core = iNeed ? `I need a ${rest[2]}` : rest.join(' ');
  rest = [];
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  // a greeting the person chose is kept in every wording
  const greet = hello ? 'Hello, ' : '';
  switch (attempt % 3) {
    case 0:
      return hello ? `Hello, ${core}.` : `${cap(core)}.`;
    case 1:
      return `${greet}${hello ? 'excuse me' : 'Excuse me'}, ${core}, please.`;
    default:
      return `${greet}${hello ? 'please' : 'Please'}, ${core}.`;
  }
}
