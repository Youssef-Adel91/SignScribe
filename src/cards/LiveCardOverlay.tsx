import { CamPill } from '../ui/CameraView';
import { HoldRing } from '../ui/HoldRing';
import { Icon } from '../ui/Icon';
import { useLive } from '../vision/bits';
import { useVision } from '../vision/store';
import styles from './LiveCardOverlay.module.css';

/** The real box, label and hold ring around the card the detector sees (screen 10, live camera only). */
export function LiveCardOverlay() {
  const live = useLive();
  const ui = useVision((s) => s.cards.ui);
  if (!live || !ui.box || !ui.word) return null;
  // the picture is mirrored like a mirror, so x is flipped
  const left = (1 - (ui.box.x + ui.box.w)) * 100;
  const top = ui.box.y * 100;
  return (
    <>
      <div
        className={styles.box}
        data-testid="card-box"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${ui.box.w * 100}%`,
          height: `${ui.box.h * 100}%`,
        }}
      />
      <CamPill
        tone="green"
        style={{ left: `${left + (ui.box.w * 100) / 2}%`, top: `${Math.max(2, top - 7)}%` }}
      >
        {ui.word} card · {Math.round(ui.confidence * 100)}%
      </CamPill>
      {ui.progress > 0 && (
        <div
          className={styles.ring}
          style={{ left: `${left + ui.box.w * 100 - 4}%`, top: `${Math.max(1, top - 3)}%` }}
        >
          <HoldRing progress={ui.progress} size="100%" label={`Hold still to add ${ui.word}`}>
            <Icon name="check" size="40%" strokeWidth={3.2} />
          </HoldRing>
        </div>
      )}
    </>
  );
}
