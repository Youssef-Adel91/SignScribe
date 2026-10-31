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

/**
 * One call keeps the screen reader (aria-live) and speech in sync with what is on screen.
 * `speak: false` keeps a message for the screen reader only (screen changes are not read aloud twice).
 */
type Announce = (text: string, opts?: { speak?: boolean }) => void;
const AnnounceContext = createContext<Announce>(() => {});

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  const toggle = useRef(false);
  const announce = useCallback<Announce>((t, opts) => {
    // Alternate a zero-width space so repeating the same sentence is still announced.
    toggle.current = !toggle.current;
    setText(toggle.current ? t : `${t}\u200b`);
    if (opts?.speak !== false) speak(t);
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
 */
export function useAnnounceOnChange(
  text: string | null | undefined,
  opts: { minGapMs?: number } = {},
) {
  const announce = useAnnounce();
  const lastSpoken = useRef(-Infinity);
  const gap = opts.minGapMs ?? 0;
  useEffect(() => {
    if (!text) return;
    const now = performance.now();
    const quiet = gap > 0 && now - lastSpoken.current < gap;
    if (!quiet) lastSpoken.current = now;
    announce(text, quiet ? { speak: false } : undefined);
  }, [text, announce, gap]);
}
