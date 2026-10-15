import { HoldRing } from '../ui/HoldRing';
import { useLive } from './bits';
import { useVision } from './store';
import styles from './PointerOverlay.module.css';

/** The on-screen cursor of the pointing finger, with the dwell ring around it while a choice is held. */
export function PointerOverlay() {
  const live = useLive();
  const pointer = useVision((s) => s.ui?.pointer ?? null);
  const dwell = useVision((s) => s.ui?.dwell ?? null);
  if (!live || !pointer) return null;
  const holding = dwell && dwell.id !== null && dwell.progress > 0;
  return (
    <div
      className={styles.pointer}
      style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)` }}
      aria-hidden="true"
      data-testid="pointer"
    >
      <span className={styles.dot} />
      {holding && (
        <span className={styles.ring}>
          <HoldRing progress={dwell.progress} size="100%" label="Hold to choose" />
        </span>
      )}
    </div>
  );
}
