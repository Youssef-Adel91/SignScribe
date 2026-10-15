import type { CSSProperties, ReactNode } from 'react';
import styles from './CameraView.module.css';

interface Props {
  /** What this view shows, for assistive tech */
  label: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** hide the "Camera on" chip (used by the small review preview? no: it is shown there too) */
  hideChip?: boolean;
}

/**
 * Placeholder camera panel (Phase 1): dark panel with the person silhouette from the design.
 * Phase 2 puts the mirrored <video> + skeleton canvas behind the same overlays.
 * Overlay children are positioned with percentages / cqw so they follow the panel size.
 */
export function CameraView({ label, children, className = '', style, hideChip }: Props) {
  return (
    <section className={`${styles.camera} ${className}`} style={style} aria-label={label}>
      <svg
        className={styles.person}
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="400" cy="162" r="63" />
        <path d="M160 600C160 372 280 300 400 300C520 300 640 372 640 600H160Z" />
      </svg>
      {!hideChip && (
        <p className={styles.chip}>
          <span className={styles.dot} aria-hidden="true" />
          Camera on
        </p>
      )}
      {children}
    </section>
  );
}

/** Dark pill used for captions and tags on top of the camera. */
export function CamPill({
  children,
  style,
  className = '',
  tone = 'dark',
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  tone?: 'dark' | 'green';
}) {
  return (
    <p
      className={`${styles.pill} ${tone === 'green' ? styles.green : ''} ${className}`}
      style={style}
    >
      {children}
    </p>
  );
}
