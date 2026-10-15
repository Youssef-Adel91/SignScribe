import type { ReactNode } from 'react';
import styles from './HoldRing.module.css';

interface Props {
  /** 0..1 */
  progress: number;
  /** CSS size */
  size: string;
  /** 'dark': for use over the camera. 'light': for use over light cards. */
  tone?: 'dark' | 'light';
  /** Accessible description of what is being held */
  label: string;
  children?: ReactNode;
  className?: string;
}

/**
 * The one component that shows "hold to confirm" progress (dwell, wake gesture, card hold).
 * With prefers-reduced-motion the arc simply jumps instead of animating.
 */
export function HoldRing({ progress, size, tone = 'dark', label, children, className }: Props) {
  const p = Math.max(0, Math.min(1, progress));
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={`${styles.ring} ${styles[tone]} ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
    >
      <svg viewBox="0 0 100 100" className={styles.svg} aria-hidden="true" focusable="false">
        <circle className={styles.disc} cx="50" cy="50" r="50" />
        <circle className={styles.track} cx="50" cy="50" r={r} />
        <circle
          className={styles.arc}
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={`${c * p} ${c}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className={styles.center}>{children}</div>
    </div>
  );
}
