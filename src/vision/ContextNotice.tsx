import { useAnnounceOnChange } from '../output/announcer';
import { useScreenNumber } from '../state/MachineProvider';
import { useVision } from './store';
import styles from './StatusBanner.module.css';

/** screens where the camera must see a hand all the time */
const WATCHED = new Set([6, 7, 9, 10]);

/**
 * Tells the person, in one sentence, when light or distance drifts away from what the setup
 * check accepted. It never blocks anything and does not appear on screens that need no hand.
 */
export function ContextNotice() {
  const screen = useScreenNumber();
  const message = useVision((s) => s.advice.message);
  const show = WATCHED.has(screen) ? message : null;
  useAnnounceOnChange(show);
  if (!show) return null;
  return (
    <div className={`${styles.banner} ${styles.tip}`} role="status" data-testid="context-notice">
      {show}
    </div>
  );
}
