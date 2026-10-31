import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARABIC_HELPER_WORDS, arabicTokenAllowed, normalizeArabic } from '../src/nlp/arabicWords';
import { validateSentence } from '../src/nlp/validate';
import { SYSTEM_PROMPT_ARABIC } from '../server/llm';

const doc = readFileSync('docs/ARABIC_WORDS.md', 'utf8');
const ok = (chosen: string[], text: string) => validateSentence(chosen, text, 'arabic');

describe('the helper-word list', () => {
  it('is small and made only of Arabic letters', () => {
    expect(ARABIC_HELPER_WORDS.length).toBeGreaterThan(20);
    expect(ARABIC_HELPER_WORDS.length).toBeLessThan(80);
    for (const w of ARABIC_HELPER_WORDS) expect(w).toMatch(/^[ء-ي]+$/);
  });
  it('has no duplicate entry, also after vowel marks and alef forms are ignored', () => {
    const seen = new Map<string, number>();
    for (const w of ARABIC_HELPER_WORDS)
      seen.set(normalizeArabic(w), (seen.get(normalizeArabic(w)) ?? 0) + 1);
    const twice = [...seen].filter(([, n]) => n > 1).map(([w]) => w);
    expect(twice).toEqual([]);
    expect(ARABIC_HELPER_WORDS.length).toBe(new Set(ARABIC_HELPER_WORDS).size);
  });
  it('still has min (من) once, for "min fadlak" and for "from"', () => {
    expect(ARABIC_HELPER_WORDS.filter((w) => w === 'من')).toHaveLength(1);
  });
  it('has no negation, no numbers and no yes / because / then', () => {
    const banned = ['لا', 'لم', 'لن', 'ليس', 'غير', 'بدون', 'نعم', 'لأن', 'ثم', 'واحد', 'اثنان'];
    const have = new Set(ARABIC_HELPER_WORDS.map(normalizeArabic));
    for (const b of banned) expect(have.has(normalizeArabic(b))).toBe(false);
  });
  it('is described word for word in docs/ARABIC_WORDS.md, which says it was written by us', () => {
    for (const w of ARABIC_HELPER_WORDS) expect(doc).toContain(w);
    expect(doc).toMatch(/written by us for this project/);
    expect(doc).toContain(`(${ARABIC_HELPER_WORDS.length} words)`);
  });
  it('is credited in docs/CREDITS.md as written by us', () => {
    expect(readFileSync('docs/CREDITS.md', 'utf8')).toContain('src/nlp/arabicWords.ts');
  });
});

describe('comparing Arabic words', () => {
  it('ignores vowel marks, the stretching line and the alef and yeh variants', () => {
    expect(normalizeArabic('أَحْتَاجُ')).toBe(normalizeArabic('احتاج'));
    expect(normalizeArabic('إلى')).toBe(normalizeArabic('الي'));
    expect(normalizeArabic('طـبيب')).toBe('طبيب');
  });
  it('does not ignore teh marbuta', () => {
    expect(normalizeArabic('طبيبة')).not.toBe(normalizeArabic('طبيبه'));
  });
});

describe('a token is allowed only if it is a helper word or a chosen word', () => {
  const chosen = ['طبيب', 'ماء'];
  it.each([
    'أحتاج',
    'من',
    'فضلك',
    'طبيب',
    'ماء',
    'وماء',
    'والماء',
    'بالماء',
    'للطبيب',
    'أَحْتَاجُ',
    'احتاج',
  ])('%s', (t) => expect(arabicTokenAllowed(t, chosen)).toBe(true));
  it.each(['دواء', 'غدا', 'طبيبة', 'طبيبي', 'لا', 'ليس', 'خمسة', 'كثيرجدا', 'لوماء', 'سيارة'])(
    '%s is not',
    (t) => expect(arabicTokenAllowed(t, chosen)).toBe(false),
  );
  it('a one-letter chosen word is never glued to something else', () => {
    expect(arabicTokenAllowed('وب', ['ب'])).toBe(false);
  });
});

describe('the validator with the list', () => {
  it('accepts a sentence of chosen words and helper words', () => {
    expect(ok(['طبيب'], 'أحتاج طبيب من فضلك').ok).toBe(true);
    expect(ok(['طبيب', 'ماء'], 'أريد طبيب وماء').ok).toBe(true);
    expect(ok(['ماء'], 'هل ممكن ماء؟').ok).toBe(true);
  });
  it('refuses a word that was not chosen and is not in the list', () => {
    const v = ok(['طبيب'], 'أحتاج طبيب غدا');
    expect(v).toEqual({ ok: false, reason: 'added word' });
  });
  it('refuses a negation, a number word and an invented fact', () => {
    expect(ok(['طبيب'], 'لا أحتاج طبيب').ok).toBe(false);
    expect(ok(['طبيب'], 'أحتاج طبيب خمسة').ok).toBe(false);
    expect(ok(['طبيب'], 'أحتاج طبيب بسبب الألم').ok).toBe(false);
  });
  it('a chosen word hidden inside a longer word does not count', () => {
    expect(ok(['طبيب'], 'أحتاج طبيبة').ok).toBe(false);
  });
  it('vowel marks on an unlisted word do not hide it', () => {
    expect(ok(['طبيب'], 'أحتاج طبيب غَدًا').ok).toBe(false);
  });
  it('English stays as it was', () => {
    expect(validateSentence(['DOCTOR'], 'I need a doctor, please.').ok).toBe(true);
  });
});

describe('the language model is told the same list', () => {
  it('lists every helper word in its instructions', () => {
    for (const w of ARABIC_HELPER_WORDS) expect(SYSTEM_PROMPT_ARABIC).toContain(w);
    expect(SYSTEM_PROMPT_ARABIC).toMatch(/only these helper words/);
  });
});
