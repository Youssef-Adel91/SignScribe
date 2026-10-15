import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavContext, type Nav } from './nav';
import { SessionProvider } from './session';
import { SCREENS } from './screens';

const W = 1440;
const H = 900;
const HELP = 13;

function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H, 1));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

export default function App() {
  const [n, setN] = useState(() => {
    const m = /^#(\d+)$/.exec(window.location.hash);
    const v = m ? parseInt(m[1], 10) : 1;
    return v >= 1 && v <= SCREENS.length ? v : 1;
  });
  const [history, setHistory] = useState<number[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const scale = useFitScale();
  const cur = useRef(n);
  cur.current = n;
  const hist = useRef(history);
  hist.current = history;

  const go = useCallback((to: number) => {
    const from = cur.current;
    if (to === from) return;
    setHistory((h) => [...h, from]);
    setN(to);
  }, []);
  const back = useCallback(() => {
    const h = hist.current;
    if (h.length === 0) return;
    setN(h[h.length - 1]);
    setHistory(h.slice(0, -1));
  }, []);
  const next = useCallback(() => {
    const c = cur.current;
    if (c === 1) return go(2);
    if (c === 5) return go(sessionMethod.current === 'card' ? 10 : 6);
    if (c === 6) return go(7);
    if (c === 7) return go(9);
    if (c === 8) return go(7);
    if (c === 9) return go(11);
    if (c === 10) return go(11);
    if (c === 11) return go(12);
    if (c === 12) return go(1);
    if (c === HELP) return back();
    return go(Math.min(c + 1, SCREENS.length - 1));
  }, [go, back]);
  const help = useCallback(() => {
    if (cur.current === HELP) back();
    else go(HELP);
  }, [go, back]);

  const nav: Nav = useMemo(() => ({ go, back, next, help }), [go, back, next, help]);

  useEffect(() => {
    window.history.replaceState(null, '', `#${n}`);
    document.title = `SignScribe · ${SCREENS[n - 1].name}`;
  }, [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') go(Math.min(cur.current + 1, SCREENS.length));
      else if (e.key === 'ArrowLeft') go(Math.max(cur.current - 1, 1));
      else if (e.key === '?' || e.key === 'h' || e.key === 'H') help();
      else if (e.key === 'Escape') { if (cur.current === HELP) back(); setListOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, back, help]);

  const { Component } = SCREENS[n - 1];

  return (
    <SessionProvider>
      <MethodSync />
      <NavContext.Provider value={nav}>
        <div className="stage-wrap">
          <div className="stage" style={{ transform: `scale(${scale})`, width: W, height: H }}>
            <Component key={n} />
          </div>
        </div>
        <div className="proto" data-proto>
          {listOpen && (
            <div className="proto-list">
              {SCREENS.map((s, i) => (
                <button key={s.name} aria-current={i + 1 === n} onClick={() => { go(i + 1); setListOpen(false); }}>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>{s.name.slice(3)}
                </button>
              ))}
            </div>
          )}
          <div className="proto-bar">
            <button onClick={() => go(Math.max(n - 1, 1))} aria-label="Previous screen">←</button>
            <button className="lbl" onClick={() => setListOpen((o) => !o)}>{SCREENS[n - 1].name}</button>
            <button onClick={() => go(Math.min(n + 1, SCREENS.length))} aria-label="Next screen">→</button>
          </div>
        </div>
      </NavContext.Provider>
    </SessionProvider>
  );
}

import { useSession } from './session';
const sessionMethod: { current: 'spell' | 'card' } = { current: 'spell' };
function MethodSync() {
  sessionMethod.current = useSession().method;
  return null;
}
