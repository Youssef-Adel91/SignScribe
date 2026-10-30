/**
 * The Arabic helper words a sentence may contain besides the words the person chose (ArSL stage 1). Written by us for this project,
 * no outside source; listed and explained in docs/ARABIC_WORDS.md (a test keeps the two in step).
 *
 * Same idea as FUNCTION_WORDS in validate.ts: only words that add no fact. No nouns, names, numbers, times, places and NO negation
 * (لا, لم, لن, ليس, غير, بدون): a sentence must never say the opposite of what was chosen. Every entry is a judgement call.
 *
 * This file must stay free of imports and of syntax Node's type stripping cannot run: the Node server imports it through validate.ts.
 */
export const ARABIC_HELPER_WORDS: readonly string[] = [
  // I, we, you, he, she, they, this, that, here, there
  'أنا',
  'نحن',
  'أنت',
  'أنتم',
  'هو',
  'هي',
  'هم',
  'هذا',
  'هذه',
  'ذلك',
  'تلك',
  'هنا',
  'هناك',
  // small joining words
  'و',
  'أو',
  'لكن',
  'إذا',
  'في',
  'على',
  'من',
  'إلى',
  'عن',
  'مع',
  // asking politely
  'من',
  'فضلك',
  'لو',
  'سمحت',
  'ممكن',
  'يمكن',
  'أرجو',
  'هل',
  // wanting and needing
  'أريد',
  'أحتاج',
  'نحتاج',
  'نريد',
  'يريد',
  'يحتاج',
  // question words
  'ما',
  'ماذا',
  'أين',
  'متى',
  'كيف',
  'كم',
  // greetings and thanks
  'مرحبا',
  'أهلا',
  'شكرا',
  'عفوا',
  'آسف',
  'آسفة',
  // how much
  'جدا',
  'قليلا',
  'كثيرا',
  'الآن',
];

/**
 * Compare Arabic words the way a reader does: without vowel marks and the stretching line, with the alef and yeh variants made equal.
 * (Teh marbuta stays as it is: it can change a word.)
 */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي');
}

const HELPERS = new Set(ARABIC_HELPER_WORDS.map(normalizeArabic));

/** the small words that are written joined to the next word: wa or fa, then bi / li / ka and the article (bi+al = bial), or li+al = lil */
const PREFIXES =
  /^(?:[\u0648\u0641])?(?:\u0644\u0644|[\u0628\u0644\u0643](?:\u0627\u0644)?|\u0627\u0644)?/;

/**
 * Is `token` allowed in a sentence made from the `chosen` words? Yes when it is a helper word, or one of the chosen words,
 * or a chosen word with the small joined words in front of it (وماء). Nothing else: a longer or different word is "added".
 */
export function arabicTokenAllowed(token: string, chosen: readonly string[]): boolean {
  const t = normalizeArabic(token);
  if (HELPERS.has(t)) return true;
  for (const c of chosen) {
    for (const part of c.split(/\s+/)) {
      const w = normalizeArabic(part);
      if (!w) continue;
      if (t === w) return true;
      if (t.endsWith(w) && t.length > w.length && w.length >= 2) {
        const rest = t.slice(0, t.length - w.length);
        const m = PREFIXES.exec(rest);
        if (m && m[0] === rest) return true;
      }
    }
  }
  return false;
}
