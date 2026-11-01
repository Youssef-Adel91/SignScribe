import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../src/state/settings';
import { DEFAULT_SETTINGS } from '../src/state/machine';

describe('settings storage', () => {
  beforeEach(() => localStorage.clear());
  it('returns defaults when nothing is stored', () =>
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS));
  it('round-trips', () => {
    const s = {
      hand: 'left',
      alphabet: 'english',
      textSize: 'xlarge',
      contrast: 'high',
      dwell: 'slow',
      voice: false,
      feedback: false,
      gender: 'female',
    } as const;
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });
  it('ignores corrupt or unknown values', () => {
    localStorage.setItem('signscribe.settings.v2', '{"hand":"banana"');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(
      'signscribe.settings.v2',
      JSON.stringify({ hand: 'x', alphabet: 'arabic', textSize: 'huge', dwell: 'warp', voice: 3 }),
    );
    const s = loadSettings();
    expect(['left', 'right']).toContain(s.hand);
    expect(s.alphabet).toBe('arabic'); // ArSL is a choice now (see tests/arsl-app.test.ts)
    expect(s.textSize).toBe(DEFAULT_SETTINGS.textSize);
    expect(s.dwell).toBe('auto');
    expect(s.voice).toBe(DEFAULT_SETTINGS.voice);
  });
  it('migrates the Phase 1/2 "display" choice', () => {
    localStorage.setItem(
      'signscribe.settings.v1',
      JSON.stringify({ hand: 'left', display: 'contrast' }),
    );
    expect(loadSettings()).toMatchObject({ hand: 'left', textSize: 'large', contrast: 'high' });
  });
});
