import { useAlphabet } from '../ui/useAlphabet';
import { HoldRing } from '../ui/HoldRing';
import { useLive } from '../vision/bits';
import { useVision } from '../vision/store';
import styles from './LiveLetterRing.module.css';

/** The real "hold to write this letter" ring on screen 07 (the design's ring is a static picture). */
export function LiveLetterRing() {
  const live = useLive();
  const ui = useVision((s) => s.letters.ui);
  const { glyph } = useAlphabet();
  if (!live || !ui?.guess || ui.progress <= 0) return null;
  const shown = glyph(ui.guess.letter).text;
  return (
    <div className={styles.ring}>
      <HoldRing progress={ui.progress} size="100%" label={`Hold to write ${shown}`}>
        <span className={styles.letter}>{shown}</span>
      </HoldRing>
    </div>
  );
}
