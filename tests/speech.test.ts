import { beforeEach, describe, expect, it } from 'vitest';
import { resetSpeechMemory, setSpeechEnabled, setSynth, speak } from '../src/output/speech';

const said: string[] = [];
let cancels = 0;
beforeEach(() => {
  said.length = 0;
  cancels = 0;
  resetSpeechMemory();
  setSpeechEnabled(true);
  setSynth({ speak: (t) => said.push(t), cancel: () => cancels++ });
});

describe('speech', () => {
  it('says text and cancels what was being said', () => {
    expect(speak('Hello')).toBe(true);
    expect(said).toEqual(['Hello']);
    expect(cancels).toBe(1);
  });
  it('is silent when switched off, and stops talking at once', () => {
    setSpeechEnabled(false);
    expect(cancels).toBe(1);
    expect(speak('Hello')).toBe(false);
    expect(said).toEqual([]);
  });
  it('does not repeat the same text twice in a row unless asked', () => {
    speak('A');
    expect(speak('A')).toBe(false);
    expect(speak('A', { repeat: true })).toBe(true);
    expect(said).toEqual(['A', 'A']);
  });
  it('ignores empty text and the zero-width space the live region uses', () => {
    expect(speak('')).toBe(false);
    expect(speak('​')).toBe(false);
    expect(speak('Hi​')).toBe(true);
    expect(said).toEqual(['Hi']);
  });
  it('never throws when the synth fails', () => {
    setSynth({
      speak: () => {
        throw new Error('no voice');
      },
      cancel: () => {},
    });
    expect(speak('x')).toBe(false);
  });
});
