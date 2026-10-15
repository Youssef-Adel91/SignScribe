import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../src/state/settings';
import { DEFAULT_SETTINGS } from '../src/state/machine';

describe('settings storage', () => {
  beforeEach(() => localStorage.clear());
  it('returns defaults when nothing is stored', () =>
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS));
  it('round-trips', () => {
    saveSettings({ hand: 'left', alphabet: 'english', display: 'contrast' });
    expect(loadSettings()).toEqual({ hand: 'left', alphabet: 'english', display: 'contrast' });
  });
  it('ignores corrupt or unknown values', () => {
    localStorage.setItem('signscribe.settings.v1', '{"hand":"banana"');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(
      'signscribe.settings.v1',
      JSON.stringify({ hand: 'x', alphabet: 'arabic', display: 'large' }),
    );
    const s = loadSettings();
    expect(['left', 'right']).toContain(s.hand);
    expect(s.alphabet).toBe('english'); // Arabic is not available yet
  });
});
