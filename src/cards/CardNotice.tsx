import { useAnnounceOnChange } from '../output/announcer';
import { useScreenNumber } from '../state/MachineProvider';
import { useVision } from '../vision/store';
import styles from '../vision/StatusBanner.module.css';

/** Says plainly when cards cannot be detected (no model yet, broken model, test model) or a card is not in this place's pack. */
export function CardNotice() {
  const screen = useScreenNumber();
  const status = useVision((s) => s.cards.status);
  const message = useVision((s) => s.cards.message);
  const synthetic = useVision((s) => s.cards.synthetic);
  const foreign = useVision((s) => s.cards.ui.foreign);
  const live = useVision((s) => s.status === 'running');
  let text: string | null = null;
  if (live && screen === 10) {
    if (status === 'missing')
      text =
        'No card detector has been trained yet. Point at a card in the list on the right to add it.';
    else if (status === 'error') text = `The card detector could not be used: ${message}`;
    else if (status === 'ready' && synthetic)
      text = 'This card detector was trained on generated test data. It is not for a real study.';
    else if (foreign)
      text = `The ${foreign} card is not part of this place. Choose another place or another card.`;
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
