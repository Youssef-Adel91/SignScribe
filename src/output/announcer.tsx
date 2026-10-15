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

/**
 * One call keeps the screen reader (aria-live) and, from Phase 3, speech in sync with what is on screen.
 * Phase 1 implements the aria-live half only.
 */
type Announce = (text: string, opts?: { speak?: boolean }) => void;
const AnnounceContext = createContext<Announce>(() => {});

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  const toggle = useRef(false);
  const announce = useCallback<Announce>((t) => {
    // Alternate a zero-width space so repeating the same sentence is still announced.
    toggle.current = !toggle.current;
    setText(toggle.current ? t : `${t}\u200b`);
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

/** Visible text that is also announced whenever it changes. */
export function useAnnounceOnChange(text: string | null | undefined) {
  const announce = useAnnounce();
  useEffect(() => {
    if (text) announce(text);
  }, [text, announce]);
}
