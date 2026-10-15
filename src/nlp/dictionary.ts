import { WORDS, type Place } from './words';

export type { Place };

/** Classic Levenshtein edit distance (insert, delete, substitute = 1). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

export function isKnownWord(word: string, place: Place): boolean {
  return WORDS[place].includes(word.toUpperCase());
}

/**
 * Closest list word for a misspelt word, or null when nothing is close enough.
 * "Close enough" = distance <= 2 and <= 40% of the longer word (so short words are not guessed wildly).
 */
export function closestMatch(word: string, place: Place): string | null {
  const w = word.toUpperCase();
  if (w.length < 3 || isKnownWord(w, place)) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const cand of WORDS[place]) {
    const d = editDistance(w, cand);
    const limit = Math.min(2, Math.floor(0.4 * Math.max(w.length, cand.length)));
    if (d > limit) continue;
    // Ties: a missed or collapsed double letter (HELO -> HELLO) is likelier than a wrong letter
    // (HELO -> HELP), so a candidate that still contains every signed letter in order wins.
    const score = d * 10 + (isSubsequence(w, cand) ? 0 : 5);
    if (score < bestScore) {
      best = cand;
      bestScore = score;
    }
  }
  return best;
}

function isSubsequence(small: string, big: string): boolean {
  let i = 0;
  for (const ch of big) if (ch === small[i]) i++;
  return i === small.length;
}
