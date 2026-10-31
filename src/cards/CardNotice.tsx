import { useAnnounceOnChange } from '../output/announcer';
import { useStrings } from '../output/strings';
import { useScreenNumber } from '../state/MachineProvider';
import { useVision } from '../vision/store';
import styles from '../vision/StatusBanner.module.css';

/** Says plainly when cards cannot be detected (no model yet, broken model, test model) or a card is not in this place's pack. */
export function CardNotice() {
  const screen = useScreenNumber();
  const strings = useStrings();
  const status = useVision((s) => s.cards.status);
  const message = useVision((s) => s.cards.message);
  const synthetic = useVision((s) => s.cards.synthetic);
  const foreign = useVision((s) => s.cards.ui.foreign);
  const live = useVision((s) => s.status === 'running');
  let text: string | null = null;
  if (live && screen === 10) {
    if (status === 'missing') text = strings.cardNoticeMissing;
    else if (status === 'error') text = strings.cardNoticeError(message ?? '');
    else if (status === 'ready' && synthetic) text = strings.cardNoticeSynthetic;
    else if (foreign) text = strings.cardNoticeForeign(foreign);
  }
  useAnnounceOnChange(text);
  if (!text) return null;
  return (
    <div
      className={`${styles.banner} ${styles.problem}`}
      style={{ top: 'auto', bottom: 190 }}
      role="status"
      data-testid="card-notice"
    >
      {text}
    </div>
  );
}
