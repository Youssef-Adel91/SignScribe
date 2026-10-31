import type { Settings } from './machine';
import { parseSettings } from './settings';

/**
 * Saved settings per person, for people the Bluetooth scanner recognises. Local to this browser, keyed by the
 * label from the scanner's config (`youssef`), never a name or a device address.
 */
const key = (userId: string) => `signscribe.profile.v1.${userId}`;
const SAFE = /^[A-Za-z0-9_-]{1,32}$/;

export function loadProfile(userId: string): Settings | null {
  if (!SAFE.test(userId)) return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const p: unknown = JSON.parse(raw);
    return p && typeof p === 'object' ? parseSettings(p as Record<string, unknown>) : null;
  } catch {
    return null; // storage can be blocked or corrupt; the app still works
  }
}

export function saveProfile(userId: string, s: Settings): void {
  if (!SAFE.test(userId)) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
