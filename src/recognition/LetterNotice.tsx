import { useAnnounceOnChange } from '../output/announcer';
import { useScreenNumber } from '../state/MachineProvider';
import { useVision } from '../vision/store';
import styles from '../vision/StatusBanner.module.css';

/**
 * Says plainly when letters cannot be read: no model file yet, a broken file, or a model trained
 * on generated test data. Shown only on the spelling screens.
 */
export function LetterNotice() {
  const screen = useScreenNumber();
  const status = useVision((s) => s.letters.status);
  const message = useVision((s) => s.letters.message);
  const synthetic = useVision((s) => s.letters.synthetic);
  const live = useVision((s) => s.status === 'running');
  let text: string | null = null;
  let problem = false;
  if (live && (screen === 6 || screen === 7)) {
    if (status === 'missing') {
      text =
        'No letter model has been trained yet, so letters cannot be read. Picture cards still work.';
      problem = true;
    } else if (status === 'error') {
      text = `The letter model could not be used: ${message}`;
      problem = true;
    } else if (status === 'ready' && synthetic) {
      text = 'This letter model was trained on generated test data. It is not for a real study.';
      problem = true;
    }
  }
  useAnnounceOnChange(text);
  if (!text) return null;
  return (
    <div
      className={`${styles.banner} ${problem ? styles.problem : ''}`}
      style={{ top: 'auto', bottom: 190 }}
      role="status"
      data-testid="letter-notice"
    >
      {text}
    </div>
  );
}
