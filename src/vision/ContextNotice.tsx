import { useAnnounceOnChange } from '../output/announcer';
import { useStrings } from '../output/strings';
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
  const strings = useStrings();
  const advice = useVision((s) => s.advice);

  let msg: string | null = null;
  if (advice.light === 'dark') msg = strings.contextDark;
  else if (advice.light === 'bright') msg = strings.contextBright;
  else if (advice.distance === 'far') msg = strings.contextFar;
  else if (advice.distance === 'close') msg = strings.contextClose;
  else if (advice.message) msg = advice.message;

  const show = WATCHED.has(screen) ? msg : null;
  useAnnounceOnChange(show);
  if (!show) return null;
  return (
    <div className={`${styles.banner} ${styles.tip}`} role="status" data-testid="context-notice">
      {show}
    </div>
  );
}
