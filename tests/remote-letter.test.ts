import { beforeEach, describe, expect, it } from 'vitest';
import {
  receiveLetter,
  setLetter,
  subscribeLetter,
  type RemoteLetter,
} from '../src/nlp/remoteLetter';

describe('letters offered from another program', () => {
  let seen: (RemoteLetter | null)[];
  beforeEach(() => {
    setLetter(null);
    seen = [];
    subscribeLetter((l) => seen.push(l));
  });
  it('offers a letter of the active alphabet and drops one that is not in it', () => {
    receiveLetter({ type: 'letter', letter: 'J', score: 0.8, source: 'dollarpy', demo: true }, 5);
    receiveLetter({ type: 'letter', letter: 'ع', score: 0.8, source: 'dollarpy', demo: false }, 6);
    expect(seen.at(-1)).toEqual({ letter: 'J', score: 0.8, source: 'dollarpy', demo: true, at: 5 });
  });
  it('a newer letter replaces the offer and clearing it empties it', () => {
    receiveLetter({ type: 'letter', letter: 'J', score: 0.8, source: 'dollarpy', demo: false }, 1);
    receiveLetter({ type: 'letter', letter: 'Z', score: 0.9, source: 'dollarpy', demo: false }, 2);
    expect(seen.at(-1)?.letter).toBe('Z');
    setLetter(null);
    expect(seen.at(-1)).toBeNull();
  });
});
