import { HoldRing } from '../ui/HoldRing';
import { useLive } from '../vision/bits';
import { useVision } from '../vision/store';
import styles from './LiveLetterRing.module.css';

/** The real "hold to write this letter" ring on screen 07 (the design's ring is a static picture). */
export function LiveLetterRing() {
  const live = useLive();
  const ui = useVision((s) => s.letters.ui);
  if (!live || !ui?.guess || ui.progress <= 0) return null;
  return (
    <div className={styles.ring}>
      <HoldRing progress={ui.progress} size="100%" label={`Hold to write ${ui.guess.letter}`}>
        <span className={styles.letter}>{ui.guess.letter}</span>
      </HoldRing>
    </div>
  );
}
