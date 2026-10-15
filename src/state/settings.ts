import { DEFAULT_SETTINGS, type Settings } from './machine';

const KEY = 'signscribe.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      hand: p.hand === 'left' || p.hand === 'right' ? p.hand : DEFAULT_SETTINGS.hand,
      alphabet: p.alphabet === 'english' ? 'english' : DEFAULT_SETTINGS.alphabet,
      display:
        p.display === 'large' || p.display === 'contrast' ? p.display : DEFAULT_SETTINGS.display,
    };
  } catch {
    return DEFAULT_SETTINGS; // storage can be blocked or corrupt; the app still works
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
