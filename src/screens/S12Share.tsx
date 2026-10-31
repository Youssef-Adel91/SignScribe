import { Chip } from '../ui/Chip';
import { Hint } from '../ui/HintBar';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { READ_ALOUD_ENGLISH_ONLY } from '../ui/readAloudNote';
import { textDir, useAlphabet } from '../ui/useAlphabet';
import { useCtx } from '../state/MachineProvider';
import styles from './S12Share.module.css';
import { HandChip } from '../vision/bits';
import { useStrings } from '../output/strings';
import { useHasArabicVoice } from '../output/speech';

/** Auto-fit tiers so a long sentence still fits without scrolling. */
export function sizeTier(sentence: string): 'l' | 'm' | 's' {
  return sentence.length <= 30 ? 'l' : sentence.length <= 60 ? 'm' : 's';
}

export default function S12Share() {
  const { sentence, alphabet } = useCtx();
  const { rtl } = useAlphabet();
  const strings = useStrings();
  const hasVoice = useHasArabicVoice();
  const noArabicVoice = alphabet === 'arabic' && !hasVoice;

  useAnnounceOnChange(sentence ? strings.shareMessageForYou(sentence) : null, {
    spoken: noArabicVoice ? null : sentence ? strings.shareMessageForYou(sentence) : null,
  });

  return (
    <Screen
      steps={['done', 'done', 'done', 'active']}
      chips={
        <>
          {noArabicVoice ? (
            <Chip kind="gray">Read-aloud: English only</Chip>
          ) : (
            <Chip kind="green">{strings.readingAloud}</Chip>
          )}
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
        <p className={styles.pill} data-testid="read-aloud-status">
          <Icon name="speaker" size="var(--s-24)" />
          {noArabicVoice ? READ_ALOUD_ENGLISH_ONLY : strings.readingAloud}
        </p>
        <p className={styles.foot}>Written with SignScribe from hand signs and picture cards.</p>
      </section>
    </Screen>
  );
}
