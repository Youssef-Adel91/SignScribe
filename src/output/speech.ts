/**
 * Text to speech through the browser's SpeechSynthesis. Everything is optional: no API, no voice or
 * the setting switched off means silence, never an error. The synth is injectable so tests need no browser.
 */
import { useEffect, useState } from 'react';
import type { Lang } from './strings';

export interface SpeechSynth {
  speak(text: string, lang?: Lang): void;
  cancel(): void;
  getVoices?(): SpeechSynthesisVoice[];
}

/**
 * Pick the best matching voice for a language.
 * When Arabic is requested:
 *  1. ar-EG (Egypt)
 *  2. ar-SA (Saudi Arabia)
 *  3. any ar-*
 * Never falls back to an English voice for Arabic text.
 */
export function chooseVoice(
  voices: readonly SpeechSynthesisVoice[],
  lang: Lang,
): SpeechSynthesisVoice | null {
  if (lang === 'ar') {
    const eg = voices.find((v) => {
      const l = v.lang.toLowerCase().replace('_', '-');
      return l === 'ar-eg' || l.startsWith('ar-eg-');
    });
    if (eg) return eg;

    const sa = voices.find((v) => {
      const l = v.lang.toLowerCase().replace('_', '-');
      return l === 'ar-sa' || l.startsWith('ar-sa-');
    });
    if (sa) return sa;

    const anyAr = voices.find((v) => {
      const l = v.lang.toLowerCase().replace('_', '-');
      return l === 'ar' || l.startsWith('ar-');
    });
    if (anyAr) return anyAr;

    return null;
  }

  // lang === 'en'
  const us = voices.find((v) => {
    const l = v.lang.toLowerCase().replace('_', '-');
    return l === 'en-us' || l.startsWith('en-us-');
  });
  if (us) return us;

  const anyEn = voices.find((v) => {
    const l = v.lang.toLowerCase().replace('_', '-');
    return l === 'en' || l.startsWith('en-');
  });
  if (anyEn) return anyEn;

  return voices[0] ?? null;
}

class BrowserSynth implements SpeechSynth {
  speak(text: string, lang: Lang = 'en'): void {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    const voices = synth.getVoices?.() ?? [];
    const voice = chooseVoice(voices, lang);
    if (lang === 'ar' && !voice) {
      // Never read Arabic text with an English voice
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = 'en-US';
    }
    u.rate = 0.95;
    synth.speak(u);
  }
  cancel(): void {
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
  }
  getVoices(): SpeechSynthesisVoice[] {
    return typeof window !== 'undefined' && window.speechSynthesis?.getVoices
      ? window.speechSynthesis.getVoices()
      : [];
  }
}

let enabled = true;
let synth: SpeechSynth = new BrowserSynth();
let last = '';
let lastTime = -Infinity;

export const setSpeechEnabled = (on: boolean): void => {
  enabled = on;
  if (!on) synth.cancel();
};
export const isSpeechEnabled = (): boolean => enabled;
export const setSynth = (s: SpeechSynth): void => {
  synth = s;
};

export function hasArabicVoice(voices?: readonly SpeechSynthesisVoice[]): boolean {
  if (voices) {
    return chooseVoice(voices, 'ar') !== null;
  }
  if (synth.getVoices) {
    const v = synth.getVoices();
    if (v.length > 0) return chooseVoice(v, 'ar') !== null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis?.getVoices) {
    const v = window.speechSynthesis.getVoices();
    return chooseVoice(v, 'ar') !== null;
  }
  return false;
}

export function useHasArabicVoice(): boolean {
  const [hasVoice, setHasVoice] = useState(() => hasArabicVoice());

  useEffect(() => {
    setHasVoice(hasArabicVoice());
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const handler = () => {
      setHasVoice(hasArabicVoice());
    };
    window.speechSynthesis.addEventListener?.('voiceschanged', handler);
    return () => {
      window.speechSynthesis?.removeEventListener?.('voiceschanged', handler);
    };
  }, []);

  return hasVoice;
}

/** Say `text` now, replacing whatever is being said. Identical text within 2 seconds is said once unless repeat is requested. */
export function speak(
  text: string,
  opts: { repeat?: boolean; lang?: Lang; now?: number } = {},
): boolean {
  const t = text.split(String.fromCharCode(0x200b)).join('').trim();
  if (!enabled || !t) return false;
  const now = opts.now ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (t === last && !opts.repeat && now - lastTime < 2000) return false;
  last = t;
  lastTime = now;
  try {
    synth.cancel();
    synth.speak(t, opts.lang);
  } catch {
    return false; // speech must never break the app
  }
  return true;
}

export const resetSpeechMemory = (): void => {
  last = '';
  lastTime = -Infinity;
};
