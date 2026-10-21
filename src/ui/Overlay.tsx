import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

let open = 0;

/**
 * A page that covers the whole app (survey, keyboard task, collection page, printable cards). It is
 * rendered outside #root and #root is made inert while it is open, so screen readers and the Tab key
 * cannot reach the hidden app underneath, and there is only one main landmark at a time.
 */
export function Overlay({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.getElementById('root');
    open++;
    if (root) root.inert = true;
    return () => {
      open--;
      if (root && open === 0) root.inert = false;
    };
  }, []);
  return createPortal(children, document.body);
}

/** Researcher tools that must stay usable while an Overlay is open (the study console). */
export function Outside({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
