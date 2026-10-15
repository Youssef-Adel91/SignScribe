import { Chip } from '../ui/Chip';
import { CamPill, CameraView } from '../ui/CameraView';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { HoldRing } from '../ui/HoldRing';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import styles from './S01Welcome.module.css';

const CAPTION = 'Hand detected. Keep holding…';

export default function S01Welcome() {
  useAnnounceOnChange(CAPTION);
  return (
    <Screen
      chips={
        <>
          <Chip kind="green">Camera on</Chip>
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="open" label="Raise open hand: start" suggested />
          <Hint gesture="open" both label="Both hands up: help" />
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.intro}>
          <p className={styles.badge}>Gesture-controlled. No keyboard or mouse.</p>
          <h1 className={styles.h1}>
            Sign it.
            <br />
            See it written.
          </h1>
          <p className={styles.lede}>
            Spell with your hands or show a picture card. SignScribe writes your message for the
            person in front of you.
          </p>
          <div className={styles.wake}>
            <HandGlyph gesture="open" height="calc(var(--u) * 75)" stroke="var(--teal)" label="" />
            <div className={styles.wakeText}>
              <p className={styles.wakeTitle}>Raise your open hand to start</p>
              <p className={styles.wakeSub}>Hold it up for 2 seconds. Nothing to click or type.</p>
            </div>
          </div>
          <p className={styles.privacy}>
            <Icon name="shield" size="var(--s-22)" />
            Video is processed on this device. Nothing is recorded.
          </p>
        </div>
        <CameraView label="Camera preview. Raise an open hand to start." className={styles.cam}>
          <div className={styles.ring}>
            <HoldRing progress={0.7} size="100%" label="Wake gesture hold" />
          </div>
          <HandGlyph
            gesture="open"
            height="41.2cqw"
            stroke="var(--teal-soft)"
            dot="#fff"
            label="Open hand detected"
            className={styles.hand}
          />
          <CamPill style={{ left: '52%', top: 'auto', bottom: '12.5%' }}>{CAPTION}</CamPill>
        </CameraView>
      </div>
    </Screen>
  );
}
