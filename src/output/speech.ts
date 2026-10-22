/**
 * Text to speech through the browser's SpeechSynthesis. Everything is optional: no API, no voice or
 * the setting switched off means silence, never an error. The synth is injectable so tests need no browser.
 */
export interface SpeechSynth {
  speak(text: string): void;
  cancel(): void;
}

class BrowserSynth implements SpeechSynth {
  speak(text: string): void {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.95;
    synth.speak(u);
  }
  cancel(): void {
    window.speechSynthesis?.cancel();
  }
}

let enabled = true;
let synth: SpeechSynth = new BrowserSynth();
let last = '';

export const setSpeechEnabled = (on: boolean): void => {
  enabled = on;
  if (!on) synth.cancel();
};
export const isSpeechEnabled = (): boolean => enabled;
export const setSynth = (s: SpeechSynth): void => {
  synth = s;
};

/** Say `text` now, replacing whatever is being said. Identical text twice in a row is said once. */
export function speak(text: string, opts: { repeat?: boolean } = {}): boolean {
  const t = text.split(String.fromCharCode(0x200b)).join('').trim();
  if (!enabled || !t) return false;
  if (t === last && !opts.repeat) return false;
  last = t;
  try {
    synth.cancel();
    synth.speak(t);
  } catch {
    return false; // speech must never break the app
  }
  return true;
}

export const resetSpeechMemory = (): void => {
  last = '';
};
