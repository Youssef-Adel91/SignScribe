import { DEFAULT_SETTINGS, type Settings } from './machine';

const KEY = 'signscribe.settings.v2';
const OLD_KEY = 'signscribe.settings.v1';

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

export function parseSettings(p: Record<string, unknown>): Settings {
  const d = DEFAULT_SETTINGS;
  // v1 stored one "display" choice; map it to the two separate settings
  const legacy = p.display;
  return {
    hand: pick(p.hand, ['left', 'right'], d.hand),
    alphabet: 'english', // the other alphabets are "Coming soon"
    textSize: pick(
      p.textSize ?? (legacy === 'large' || legacy === 'contrast' ? 'large' : undefined),
      ['normal', 'large', 'xlarge'],
      d.textSize,
    ),
    contrast: pick(
      p.contrast ?? (legacy === 'contrast' ? 'high' : undefined),
      ['standard', 'high'],
      d.contrast,
    ),
    dwell: pick(p.dwell, ['auto', 'slow', 'normal', 'fast'], d.dwell),
    voice: typeof p.voice === 'boolean' ? p.voice : d.voice,
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const p: unknown = JSON.parse(raw);
    return p && typeof p === 'object'
      ? parseSettings(p as Record<string, unknown>)
      : DEFAULT_SETTINGS;
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
