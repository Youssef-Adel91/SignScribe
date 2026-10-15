import { Chip } from '../ui/Chip';
import { CamPill, CameraView } from '../ui/CameraView';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { Icon, type IconName } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import styles from './S02CameraCheck.module.css';

type Tone = 'ok' | 'warn';
/** PLACEHOLDER values (Phase 3 replaces them with live light / distance / hand sensing). */
const CHECKS: { title: string; text: string; tone: Tone; icon: IconName }[] = [
  { title: 'Light', text: 'Good light on your hands', tone: 'ok', icon: 'sun' },
  { title: 'Distance', text: 'A bit far. Move a little closer.', tone: 'warn', icon: 'move' },
  { title: 'Hand visible', text: 'Your whole hand is in view', tone: 'ok', icon: 'hand' },
];
const TIP = 'Move a little closer.';

export default function S02CameraCheck() {
  useAnnounceOnChange(`Spoken tip: ${TIP}`);
  return (
    <Screen
      steps={['active', 'todo', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="green">Camera on</Chip>
          <Chip kind="green">Hand detected</Chip>
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={<Hint gesture="open" label="Hold still while we check" suggested />}
    >
      <div className={styles.body}>
        <CameraView
          label="Camera preview with a dashed frame. Keep your hands inside it."
          className={styles.cam}
        >
          <div className={styles.frame} />
          <HandGlyph
            gesture="open"
            height="49.8cqw"
            stroke="var(--teal-soft)"
            dot="#fff"
            label="Open hand detected"
            className={styles.hand}
          />
          <CamPill style={{ left: '52%', top: 'auto', bottom: '1.5%' }}>
            Keep your hands inside the dashed frame
          </CamPill>
        </CameraView>
        <div className={styles.col}>
          <h1 className={styles.h1}>Checking your setup</h1>
          <p className={styles.lede}>
            Stay as you are. We continue automatically when everything is green.
          </p>
          <ul className={styles.checks}>
            {CHECKS.map((c) => (
              <li key={c.title} className={`${styles.check} ${styles[c.tone]}`}>
                <span className={styles.iconWrap}>
                  <Icon name={c.icon} size="var(--s-26)" />
                </span>
                <span className={styles.txt}>
                  <span className={styles.ttl}>{c.title}</span>
                  <span className={styles.sub}>{c.text}</span>
                </span>
                <Icon
                  name={c.tone === 'ok' ? 'statusOk' : 'statusWarn'}
                  size="var(--s-28)"
                  label={c.tone === 'ok' ? 'OK' : 'Needs attention'}
                />
              </li>
            ))}
          </ul>
          <p className={styles.tip}>
            <Icon name="speaker" size="var(--s-24)" />
            <span>Spoken tip: "{TIP}"</span>
          </p>
        </div>
      </div>
    </Screen>
  );
}
