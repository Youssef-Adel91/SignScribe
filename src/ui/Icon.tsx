import { ICONS, type IconName } from './iconData';

export type { IconName };

interface Props {
  name: IconName;
  /** CSS size, e.g. 24 (px) or 'var(--s-24)' */
  size?: number | string;
  /** Visible meaning for assistive tech. Omit for decorative icons (they are hidden). */
  label?: string;
  className?: string;
  /** override the stroke width (in the icon's own viewBox units) */
  strokeWidth?: number;
}

/** Line icon drawn with currentColor, so the colour comes from CSS. */
export function Icon({ name, size = 24, label, className, strokeWidth }: Props) {
  const def = ICONS[name];
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      viewBox={`0 0 ${def.vb} ${def.vb}`}
      width={px}
      height={px}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? def.sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ width: px, height: px, flex: 'none' }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {def.d.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
