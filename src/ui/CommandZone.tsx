import { HandGlyph, type Gesture } from './HandGlyph';
import styles from './CommandZone.module.css';
import type { Hand } from '../state/machine';
import { useActiveCommand } from '../vision/bits';

const ITEMS: { gesture: Gesture; label: string }[] = [
  { gesture: 'open', label: 'Space' },
  { gesture: 'fist', label: 'Delete' },
  { gesture: 'up', label: 'Done' },
  { gesture: 'down', label: 'Cancel' },
];

/** The signing hand is the one that makes letters; the OTHER hand stays here, so the zone sits on the other side. */
export const zoneSide = (signing: Hand): 'left' | 'right' =>
  signing === 'right' ? 'left' : 'right';

interface Props {
  signingHand: Hand;
  /** inactive look for "hand lost": lighter text colour, never a lowered opacity */
  idle?: boolean;
  /** highlight the item the user is currently showing */
  active?: 'Space' | 'Delete' | 'Done' | 'Cancel';
}

export function CommandZone({ signingHand, idle, active: designActive }: Props) {
  const side = zoneSide(signingHand);
  const active = useActiveCommand(designActive);
  return (
    <section
      className={`${styles.zone} ${side === 'left' ? styles.left : styles.right} ${idle ? styles.idle : ''}`}
      aria-label={`Command zone, ${side} side of the camera. Keep your ${side} hand here.`}
    >
      <h3 className={styles.title}>COMMAND ZONE</h3>
      <ul className={styles.items}>
        {ITEMS.map((it) => (
          <li key={it.label} className={`${styles.item} ${active === it.label ? styles.on : ''}`}>
            <HandGlyph
              gesture={it.gesture}
              height="max(56px, 7.1cqw)"
              stroke={idle ? '#94a3b8' : 'var(--teal-soft)'}
              dot={idle ? '#cbd5e1' : '#ffffff'}
              label=""
            />
            <span className={styles.label}>{it.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Dashed rectangle where the signing hand makes letters; sits on the signing hand's side. */
export function SigningArea({ signingHand }: { signingHand: Hand }) {
  return (
    <div
      className={`${styles.area} ${signingHand === 'right' ? styles.areaRight : styles.areaLeft}`}
      aria-hidden="true"
    >
      <span className={styles.areaLabel}>SIGNING AREA</span>
    </div>
  );
}
