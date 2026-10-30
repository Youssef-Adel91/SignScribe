import { Chip } from '../ui/Chip';
import { Hint } from '../ui/HintBar';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { textDir, useAlphabet } from '../ui/useAlphabet';
import { useCtx } from '../state/MachineProvider';
import styles from './S12Share.module.css';
import { HandChip } from '../vision/bits';

/** Auto-fit tiers so a long sentence still fits without scrolling. */
export function sizeTier(sentence: string): 'l' | 'm' | 's' {
  return sentence.length <= 30 ? 'l' : sentence.length <= 60 ? 'm' : 's';
}

export default function S12Share() {
  const { sentence } = useCtx();
  const { rtl } = useAlphabet();
  useAnnounceOnChange(sentence ? `Message for you: ${sentence}` : null);
  return (
    <Screen
      steps={['done', 'done', 'done', 'active']}
      chips={
        <>
          <Chip kind="green">Reading aloud</Chip>
          <HandChip />
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="up" label="Finish" suggested />
          <Hint gesture="open" label="New sentence" />
          <Hint gesture="down" label="Edit" />
        </>
      }
      mainClass={styles.main}
    >
      <section className={styles.card} aria-label="Message for you">
        <h1 className={styles.label}>MESSAGE FOR YOU</h1>
        <p className={`${styles.sentence} ${styles[sizeTier(sentence)]}`} {...textDir(rtl)}>
          {sentence}
        </p>
        <p className={styles.pill}>
          <Icon name="speaker" size="var(--s-24)" />
          Reading aloud…
        </p>
        <p className={styles.foot}>Written with SignScribe from hand signs and picture cards.</p>
      </section>
    </Screen>
  );
}
