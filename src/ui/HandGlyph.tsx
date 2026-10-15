import type { CSSProperties } from 'react';
import { POSES, type Pose } from './handData';
import styles from './HandGlyph.module.css';

export type Gesture = 'open' | 'point' | 'fist' | 'up' | 'down';
export type Glyph = Gesture | 'openLeft';

const NAMES: Record<Glyph, string> = {
  open: 'Open palm',
  openLeft: 'Open palm, left hand',
  point: 'Pointing finger',
  fist: 'Fist',
  up: 'Thumbs up',
  down: 'Thumbs down',
};

interface Props {
  gesture: Glyph;
  /** height in CSS units (width follows at 1:1.3) */
  height: string;
  /** line colour */
  stroke?: string;
  /** joint colour; defaults to the line colour */
  dot?: string;
  /** accessible name; defaults to the gesture name. Pass '' for a decorative glyph. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Hand drawn as 21 landmark points joined by lines, like the MediaPipe skeleton.
 * Lines never get thinner than 3px and joints never smaller than 2.5px radius so it stays readable at 1 m.
 */
export function HandGlyph({
  gesture,
  height,
  stroke = 'currentColor',
  dot,
  label,
  className,
  style,
}: Props) {
  const pose = POSES[gesture as Pose];
  const name = label === undefined ? NAMES[gesture] : label;
  const vars = {
    '--h': height,
    '--stroke': stroke,
    '--dot': dot ?? stroke,
    ...style,
  } as CSSProperties;
  return (
    <svg
      viewBox="0 0 1000 1300"
      className={`${styles.hand} ${className ?? ''}`}
      style={vars}
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      focusable="false"
    >
      {pose.lines.map((pts, i) => (
        <polyline
          key={i}
          className={styles.line}
          points={pts.map(([x, y]) => `${x},${y * 1.3}`).join(' ')}
        />
      ))}
      {pose.dots.map(([x, y], i) => (
        <circle key={i} className={styles.dot} cx={x} cy={y * 1.3} />
      ))}
    </svg>
  );
}
