import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Tile.module.css';

interface Props {
  selected?: boolean;
  /** "Coming soon": shown, never hidden, not selectable */
  unavailable?: boolean;
  title: string;
  sub?: string;
  children?: ReactNode;
  className?: string;
  /** big title, used for the main choice tiles */
  size?: 'sm' | 'md' | 'lg';
}

/** A choice. It is chosen by pointing and holding (the camera), so it has no click handler. */
export function Tile({
  selected,
  unavailable,
  title,
  sub,
  children,
  className = '',
  size = 'md',
}: Props) {
  return (
    <li
      className={`${styles.tile} ${styles[size]} ${selected ? styles.selected : ''} ${unavailable ? styles.off : ''} ${className}`}
    >
      {children}
      <span className={styles.title}>{title}</span>
      {sub && <span className={styles.sub}>{sub}</span>}
      {unavailable && <span className={styles.soon}>Coming soon</span>}
      {selected && (
        <span className={styles.check}>
          <Icon name="check" size="var(--s-22)" strokeWidth={3} />
        </span>
      )}
      <span className="sr-only">
        {selected ? ', selected' : ''}
        {unavailable ? ', not available yet' : ''}
      </span>
    </li>
  );
}
