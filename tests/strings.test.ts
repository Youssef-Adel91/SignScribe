import { describe, expect, it } from 'vitest';
import { STRINGS, getStrings, type AppStrings } from '../src/output/strings';

describe('strings table', () => {
  const enKeys = Object.keys(STRINGS.en) as (keyof AppStrings)[];
  const arKeys = Object.keys(STRINGS.ar) as (keyof AppStrings)[];

  it('every key in en exists in ar, and every key in ar exists in en', () => {
    expect(enKeys.sort()).toEqual(arKeys.sort());
  });

  it('every string key has a non-empty string in both languages', () => {
    for (const k of enKeys) {
      const enVal = STRINGS.en[k];
      const arVal = STRINGS.ar[k];
      if (typeof enVal === 'string') {
        expect(typeof arVal).toBe('string');
        expect(enVal.trim().length).toBeGreaterThan(0);
        expect((arVal as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('every function key returns a non-empty string in both languages', () => {
    for (const k of enKeys) {
      const enVal = STRINGS.en[k];
      const arVal = STRINGS.ar[k];
      if (typeof enVal === 'function') {
        expect(typeof arVal).toBe('function');
        const enRes = (enVal as (a: string, b: string, c: string) => string)('X', 'Y', 'Z');
        const arRes = (arVal as (a: string, b: string, c: string) => string)('X', 'Y', 'Z');
        expect(typeof enRes).toBe('string');
        expect(enRes.trim().length).toBeGreaterThan(0);
        expect(typeof arRes).toBe('string');
        expect(arRes.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('getStrings returns the requested language table and defaults to en', () => {
    expect(getStrings('en')).toBe(STRINGS.en);
    expect(getStrings('ar')).toBe(STRINGS.ar);
    expect(getStrings(undefined)).toBe(STRINGS.en);
  });
});

