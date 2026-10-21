import { describe, expect, it } from 'vitest';
import { offlineSentence } from '../src/nlp/sentence';
import { validateSentence, sameWord } from '../src/nlp/validate';
import { CARD_PACKS } from '../src/screens/cardPack';
import type { Place } from '../src/nlp/words';

const ok = (words: string[], s: string) =>
  expect(validateSentence(words, s), s).toEqual({ ok: true });
const bad = (words: string[], s: string, why: RegExp) => {
  const v = validateSentence(words, s);
  expect(v.ok, s).toBe(false);
  if (!v.ok) expect(v.reason, s).toMatch(why);
};

describe('safety rule for suggested sentences', () => {
  it('accepts a sentence with every chosen word and only helper words added', () => {
    ok(['DOCTOR', 'HELP'], 'I need a doctor, please help.');
    ok(['DOCTOR', 'HELP'], 'Doctor help.');
    ok(['PRICE'], 'Excuse me, what is the price?');
    ok(['THANK YOU'], 'Thank you.');
    ok(['I', 'NEED', 'DOCTOR'], 'I need a doctor.');
  });
  it('accepts simple endings of the chosen words', () => {
    ok(['MEDICINE'], 'I want some medicines, please.');
    ok(['BREATHE'], 'I am breathing, please wait.'.replace(', please wait', ''));
    ok(['STOP'], 'I am stopped.');
    expect(sameWord('needs', 'need')).toBe(true);
    expect(sameWord('needed', 'need')).toBe(true);
    expect(sameWord('breathing', 'breathe')).toBe(true);
    expect(sameWord('stopped', 'stop')).toBe(true);
    expect(sameWord('dollars', 'doctor')).toBe(false);
  });
  it('rejects a sentence that drops a chosen word', () => {
    bad(['DOCTOR', 'HELP'], 'I need a doctor.', /missing word: help/);
    bad(['PAIN'], 'Please help me.', /missing word: pain/);
  });
  it('rejects added facts: new nouns, names, times, places, numbers', () => {
    bad(['DOCTOR'], 'I need a doctor for my headache.', /added word: headache/);
    bad(['DOCTOR'], 'I need a doctor at 5 pm.', /added word: 5/);
    bad(['HELP'], 'Please help, Sarah.', /added word: sarah/);
    bad(['WATER'], 'I want water from the kitchen.', /added word/);
    bad(['MEDICINE'], 'I need my medicine twice a day.', /added word: twice/);
  });
  it('rejects negations that were not chosen (they flip the meaning)', () => {
    bad(['HELP'], "I don't need help.", /added word/);
    bad(['PAIN'], 'No pain.', /added word: no/);
    bad(['HELP'], 'I cannot help.', /added word: cannot/);
  });
  it('allows a negation only when the person chose it', () => {
    ok(['NO', 'PAIN'], 'No pain.');
  });
  it('rejects links, odd characters, empty text, and long text', () => {
    bad(['HELP'], 'Help www.example.com', /link/);
    bad(['HELP'], 'Help me <b>now</b>', /unexpected characters/);
    bad(['HELP'], '   ', /empty/);
    bad(['HELP'], 'Help '.repeat(40), /too long|too many/);
    bad(['HELP'], 'Help. Please. Now. Help. Please.', /more than two sentences/);
  });
  it('is not fooled by letter case or curly apostrophes', () => {
    ok(['HELP'], 'PLEASE HELP ME');
    ok(['HELP'], 'Please help me.');
  });
});

describe('the offline rules always satisfy the rule', () => {
  it('a chosen greeting is kept in every wording (a bug the rule found in the Phase 1 builder)', () => {
    for (let a = 0; a < 3; a++)
      expect(offlineSentence(['HELLO', 'DOCTOR'], 'Clinic', a)).toMatch(/hello/i);
  });
  it('for every card of every place and every wording', () => {
    for (const [place, pack] of Object.entries(CARD_PACKS)) {
      const words = pack.map((c) => c.word.toUpperCase());
      for (const subset of [
        [words[0]],
        [words[0], words[1]],
        [words[1], words[2], words[3]],
        ['HELLO', 'I', 'NEED', words[0]],
      ]) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const s = offlineSentence(subset, place as Place, attempt);
          expect(
            validateSentence(subset, s),
            `${place} ${subset.join(' ')} #${attempt}: ${s}`,
          ).toEqual({ ok: true });
        }
      }
    }
  });
});
