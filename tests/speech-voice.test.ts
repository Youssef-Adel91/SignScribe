import { beforeEach, describe, expect, it } from 'vitest';
import {
  chooseVoice,
  hasArabicVoice,
  resetSpeechMemory,
  setSpeechEnabled,
  setSynth,
  speak,
} from '../src/output/speech';
import { getAlphabet, spokenLetterOf } from '../src/config/alphabet';

function mockVoice(lang: string, name: string): SpeechSynthesisVoice {
  return {
    lang,
    name,
    default: false,
    localService: true,
    voiceURI: name,
  };
}

describe('voice selection (chooseVoice)', () => {
  it('chooses ar-EG first when Arabic is requested', () => {
    const voices = [
      mockVoice('en-US', 'David'),
      mockVoice('ar-SA', 'Naayf'),
      mockVoice('ar-EG', 'Salma'),
      mockVoice('ar-AE', 'Hamdan'),
    ];
    const picked = chooseVoice(voices, 'ar');
    expect(picked?.name).toBe('Salma');
    expect(picked?.lang).toBe('ar-EG');
  });

  it('chooses ar-SA when ar-EG is not present', () => {
    const voices = [
      mockVoice('en-US', 'David'),
      mockVoice('ar-SA', 'Naayf'),
      mockVoice('ar-AE', 'Hamdan'),
    ];
    const picked = chooseVoice(voices, 'ar');
    expect(picked?.name).toBe('Naayf');
    expect(picked?.lang).toBe('ar-SA');
  });

  it('chooses any ar-* when neither ar-EG nor ar-SA is present', () => {
    const voices = [
      mockVoice('en-US', 'David'),
      mockVoice('ar-AE', 'Hamdan'),
    ];
    const picked = chooseVoice(voices, 'ar');
    expect(picked?.name).toBe('Hamdan');
  });

  it('returns null and NEVER chooses an English voice when Arabic has no voices', () => {
    const voices = [
      mockVoice('en-US', 'David'),
      mockVoice('en-GB', 'George'),
      mockVoice('fr-FR', 'Amelie'),
    ];
    const picked = chooseVoice(voices, 'ar');
    expect(picked).toBeNull();
  });

  it('chooses en-US first when English is requested', () => {
    const voices = [
      mockVoice('en-GB', 'George'),
      mockVoice('en-US', 'David'),
      mockVoice('ar-EG', 'Salma'),
    ];
    const picked = chooseVoice(voices, 'en');
    expect(picked?.name).toBe('David');
  });

  it('falls back to any en-* when en-US is not present', () => {
    const voices = [
      mockVoice('en-GB', 'George'),
      mockVoice('ar-EG', 'Salma'),
    ];
    const picked = chooseVoice(voices, 'en');
    expect(picked?.name).toBe('George');
  });

  it('handles case-insensitivity and underscores in language tags', () => {
    const voices = [mockVoice('AR_eg', 'Egyptian Voice')];
    expect(chooseVoice(voices, 'ar')?.name).toBe('Egyptian Voice');
  });
});

describe('hasArabicVoice helper', () => {
  it('detects when an Arabic voice is present in the list', () => {
    const withAr = [mockVoice('en-US', 'Alex'), mockVoice('ar-EG', 'Salma')];
    const withoutAr = [mockVoice('en-US', 'Alex')];
    expect(hasArabicVoice(withAr)).toBe(true);
    expect(hasArabicVoice(withoutAr)).toBe(false);
    expect(hasArabicVoice([])).toBe(false);
  });
});

describe('speak rate limit and memory', () => {
  const said: { text: string; lang?: string }[] = [];
  let cancels = 0;

  beforeEach(() => {
    said.length = 0;
    cancels = 0;
    resetSpeechMemory();
    setSpeechEnabled(true);
    setSynth({
      speak: (t, lang) => said.push({ text: t, lang }),
      cancel: () => cancels++,
    });
  });

  it('enforces a 2-second rate limit on repeated identical phrases', () => {
    expect(speak('Looks like A', { now: 1000 })).toBe(true);
    // Same text within 2000 ms is blocked
    expect(speak('Looks like A', { now: 2500 })).toBe(false);
    // After 2000 ms, same text is allowed
    expect(speak('Looks like A', { now: 3500 })).toBe(true);
    expect(said).toHaveLength(2);
  });

  it('allows repeating identical text immediately when repeat: true is specified', () => {
    expect(speak('Looks like A', { now: 1000 })).toBe(true);
    expect(speak('Looks like A', { repeat: true, now: 1100 })).toBe(true);
    expect(said).toHaveLength(2);
  });

  it('allows different phrases immediately', () => {
    expect(speak('Looks like A', { now: 1000 })).toBe(true);
    expect(speak('Looks like B', { now: 1100 })).toBe(true);
    expect(said.map((s) => s.text)).toEqual(['Looks like A', 'Looks like B']);
  });

  it('passes requested language to speech synth', () => {
    speak('مرحبا', { lang: 'ar' });
    expect(said[0]).toEqual({ text: 'مرحبا', lang: 'ar' });
  });
});

describe('spoken letter resolution for Arabic and unconfirmed letters', () => {
  const arsl = getAlphabet('arsl');
  const asl = getAlphabet('asl');

  it('resolves confirmed ArSL letters to their spoken Arabic name', () => {
    const ain = spokenLetterOf(arsl, 'ain');
    expect(ain.confirmed).toBe(true);
    expect(ain.text).toBe('عين');

    const aleff = spokenLetterOf(arsl, 'aleff');
    expect(aleff.confirmed).toBe(true);
    expect(aleff.text).toBe('ألف');

    const bb = spokenLetterOf(arsl, 'bb');
    expect(bb.confirmed).toBe(true);
    expect(bb.text).toBe('باء');
  });

  it('never speaks unconfirmed ArSL letters as guessed Arabic letters', () => {
    const unconfirmed = ['ta', 'taa', 'toot', 'ha', 'haa', 'ya', 'yaa', 'dha', 'dhad', 'al', 'la'];
    for (const cls of unconfirmed) {
      const spk = spokenLetterOf(arsl, cls);
      expect(spk.confirmed).toBe(false);
      expect(spk.text).toBe('');
    }
  });

  it('resolves ASL letters to their letter glyph', () => {
    const a = spokenLetterOf(asl, 'A');
    expect(a.confirmed).toBe(true);
    expect(a.text).toBe('A');
  });
});
