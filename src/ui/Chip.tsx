import type { ReactNode } from 'react';
import styles from './Chip.module.css';

export type ChipKind = 'green' | 'gray' | 'amber';

/** Status pill. Display-only (not a control); the text always says what the colour means. */
export function Chip({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  return (
    <li className={`${styles.chip} ${styles[kind]}`}>
      <span className={styles.dot} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}
