import { describe, expect, it } from 'vitest';
import { closestMatch, editDistance, isKnownWord } from '../src/nlp/dictionary';
import { WORDS } from '../src/nlp/words';
import { offlineSentence } from '../src/nlp/sentence';

describe('word lists', () => {
  for (const place of ['Clinic', 'Shop', 'Work', 'Home'] as const) {
    it(`${place} has at least 60 distinct A-Z words`, () => {
      expect(new Set(WORDS[place]).size).toBeGreaterThanOrEqual(60);
      expect(WORDS[place].every((w) => /^[A-Z]+$/.test(w))).toBe(true);
    });
  }
});

describe('edit distance', () => {
  it('basic cases', () => {
    expect(editDistance('HELO', 'HELLO')).toBe(1);
    expect(editDistance('', 'AB')).toBe(2);
    expect(editDistance('CAT', 'CAT')).toBe(0);
    expect(editDistance('KITTEN', 'SITTING')).toBe(3);
  });
});

describe('closestMatch', () => {
  it('HELO -> HELLO (a collapsed double letter beats a wrong letter such as HELP)', () =>
    expect(closestMatch('HELO', 'Clinic')).toBe('HELLO'));
  it('known words and short words get no suggestion', () => {
    expect(closestMatch('DOCTOR', 'Clinic')).toBeNull();
    expect(closestMatch('AB', 'Clinic')).toBeNull();
  });
  it('names with no near neighbour get no suggestion', () => expect(closestMatch('ZQXW', 'Clinic')).toBeNull());
  it('isKnownWord is case-insensitive', () => expect(isKnownWord('doctor', 'Clinic')).toBe(true));
});

describe('offline sentence (phase 1 placeholder)', () => {
  it('Hello, I need a doctor.', () =>
    expect(offlineSentence(['HELLO', 'I', 'NEED', 'DOCTOR'], 'Clinic', 0)).toBe('Hello, I need a doctor.'));
  it('keeps every content word in every variant', () => {
    for (let a = 0; a < 3; a++) {
      const s = offlineSentence(['HELLO', 'I', 'NEED', 'DOCTOR'], 'Clinic', a).toLowerCase();
      expect(s).toContain('doctor');
      expect(s).toContain('need');
    }
  });
  it('variants differ', () => {
    const v = [0, 1, 2].map((a) => offlineSentence(['WATER'], 'Home', a));
    expect(new Set(v).size).toBe(3);
  });
});
