import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALPHABET, ALPHABET_LABELS, loadAlphabet, parseAlphabet } from '../src/config/alphabet';
import { LETTERS, MOVING_LETTERS, validateTake } from '../src/collect/dataset';

describe('alphabet config', () => {
  it('the active alphabet comes from config/alphabet.json, not from code', () => {
    const active = JSON.parse(readFileSync('config/alphabet.json', 'utf8')).active as string;
    expect(ALPHABET.id).toBe(active);
    expect(LETTERS).toEqual(ALPHABET_LABELS);
    expect(MOVING_LETTERS).toEqual(ALPHABET.dynamic);
  });
  it('every file in config/alphabets is a valid label set', () => {
    for (const f of readdirSync('config/alphabets')) {
      const name = f.replace(/\.json$/, '');
      const a = loadAlphabet(name);
      expect(a.static.length + a.dynamic.length).toBeGreaterThan(1);
    }
  });
  it('ASL has 24 still letters and J and Z that move; the ArSL file is marked as an unchecked template', () => {
    const asl = loadAlphabet('asl');
    expect(asl.static).toHaveLength(24);
    expect(asl.dynamic).toEqual(['J', 'Z']);
    expect(loadAlphabet('arsl').reviewed).toBe(false);
  });
  it('rejects empty sets, repeated labels and multi-character labels', () => {
    expect(() => parseAlphabet({}, 'x')).toThrow(/no labels/);
    expect(() => parseAlphabet({ static: ['A', 'A'] }, 'x')).toThrow(/twice/);
    expect(() => parseAlphabet({ static: ['AB'] }, 'x')).toThrow(/single character/);
    expect(() => loadAlphabet('nope')).toThrow(/no alphabet "nope"/);
  });
  it('a take is checked against the alphabet, and person/source are optional non-empty strings', () => {
    const golden = JSON.parse(readFileSync('ml/tests/golden_takes.jsonl', 'utf8').split('\n')[0]);
    expect(() => validateTake({ ...golden, label: 'ع' })).toThrow(/alphabet/);
    expect(validateTake({ ...golden, person: 'p1', source: 'cam-a' }).person).toBe('p1');
    expect(() => validateTake({ ...golden, person: ' ' })).toThrow(/person/);
  });
});
