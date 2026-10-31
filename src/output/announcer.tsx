import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { speak } from './speech';
import type { Lang } from './strings';

/**
 * One call keeps the screen reader (aria-live) and speech in sync with what is on screen.
 * `speak: false` keeps a message for the screen reader only (screen changes are not read aloud twice).
 * `spoken` allows reading an alternative pronunciation/text (e.g. spoken letter name or clean text).
 * `lang` specifies the speech synthesis language ('en' | 'ar').
 */
export type Announce = (
  text: string,
  opts?: { speak?: boolean; spoken?: string | null; lang?: Lang },
) => void;
const AnnounceContext = createContext<Announce>(() => {});

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  const toggle = useRef(false);
  const announce = useCallback<Announce>((t, opts) => {
    // Alternate a zero-width space so repeating the same sentence is still announced.
    toggle.current = !toggle.current;
    setText(toggle.current ? t : `${t}\u200b`);
    if (opts?.speak !== false) {
      const toSay = opts?.spoken !== undefined ? opts.spoken : t;
      if (toSay) {
        speak(toSay, { lang: opts?.lang });
      }
    }
  }, []);
  const value = useMemo(() => announce, [announce]);
  return (
    <AnnounceContext.Provider value={value}>
      {children}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="live-region"
      >
        {text}
      </div>
    </AnnounceContext.Provider>
  );
}

export const useAnnounce = () => useContext(AnnounceContext);

/**
 * Visible text that is also announced whenever it changes. `minGapMs` limits how often it is SPOKEN (the screen reader text
 * still updates): a guess that flickers between letters must not be read out again and again.
 * If `spoken` is provided, that text is spoken instead of `text`. If `spoken` is null, speech is skipped.
 */
export function useAnnounceOnChange(
  text: string | null | undefined,
  opts: { minGapMs?: number; spoken?: string | null; lang?: Lang } = {},
) {
  const announce = useAnnounce();
  const lastSpoken = useRef(-Infinity);
  const gap = opts.minGapMs ?? 0;
  useEffect(() => {
    if (!text) return;
    const now = performance.now();
    const quiet = gap > 0 && now - lastSpoken.current < gap;
    if (!quiet) lastSpoken.current = now;
    announce(text, { speak: !quiet, spoken: opts.spoken, lang: opts.lang });
  }, [text, announce, gap, opts.spoken, opts.lang]);
}
