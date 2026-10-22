import type { ReactNode } from 'react';
import { HandGlyph, type Gesture } from './HandGlyph';
import styles from './HintBar.module.css';

const SPOKEN: Record<Gesture, string> = {
  open: 'open palm',
  point: 'point and hold',
  fist: 'fist',
  up: 'thumbs up',
  down: 'thumbs down',
};

/** One valid gesture and what it does. Display-only: the camera performs the action, not a click. */
export function Hint({
  gesture,
  label,
  suggested,
  both,
}: {
  gesture: Gesture;
  label: string;
  suggested?: boolean;
  both?: boolean;
}) {
  return (
    <li className={`${styles.hint} ${suggested ? styles.suggested : ''}`}>
      {suggested && <span className={styles.marker}>Suggested</span>}
      <HandGlyph
        gesture={gesture}
        height="max(40px, calc(var(--u) * 47))"
        stroke="currentColor"
        label=""
      />
      {both && (
        <HandGlyph
          gesture="openLeft"
          height="max(40px, calc(var(--u) * 47))"
          stroke="currentColor"
          label=""
        />
      )}
      <span className={styles.text}>{label}</span>
      <span className="sr-only">
        , gesture: {SPOKEN[gesture]}
        {suggested ? ', suggested' : ''}
      </span>
    </li>
  );
}

export function HintBar({ children }: { children: ReactNode }) {
  return (
    <footer className={styles.bar} aria-label="Gesture hints">
      <ul className={styles.list}>{children}</ul>
    </footer>
  );
}
