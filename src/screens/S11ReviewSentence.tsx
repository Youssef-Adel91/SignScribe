import { CamPill, CameraView } from '../ui/CameraView';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { Icon } from '../ui/Icon';
import { InfoList, InfoRow } from '../ui/InfoRow';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { useCtx } from '../state/MachineProvider';
import styles from './S11ReviewSentence.module.css';
import { HandChip } from '../vision/bits';
import type { ReactNode } from 'react';
import type { Ev } from '../state/machine';
import { CommandRing, Demo } from '../vision/bits';
import { useDwellTarget } from '../vision/targets';

/** One of the two answer buttons: chosen by point-and-hold, like thumbs up / thumbs down. */
function Action({
  className,
  event,
  children,
}: {
  className: string;
  event: Ev;
  children: ReactNode;
}) {
  const ref = useDwellTarget(event);
  return (
    <li ref={ref} className={className}>
      {children}
    </li>
  );
}

export default function S11ReviewSentence() {
  const { place, words, sentence } = useCtx();
  useAnnounceOnChange(
    sentence
      ? `Suggested sentence: ${sentence}. Thumbs up to use it, thumbs down to try another.`
      : null,
  );
  return (
    <Screen
      steps={['done', 'done', 'active', 'todo']}
      chips={
        <>
          <Chip kind="gray">Context: {place}</Chip>
          <HandChip />
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="up" label="Use it" suggested />
          <Hint gesture="down" label="Try another" />
          <Hint gesture="fist" label="Delete last word" />
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.main}>
          <h1 className="sr-only">Review your sentence</h1>
          <section aria-label="Your words" className={styles.words}>
            <h2 className={styles.label}>YOUR WORDS</h2>
            <ul className={styles.chips}>
              {words.map((w, i) => (
                <li key={`${w}-${i}`} className={styles.chip}>
                  {i === words.length - 1 && words.length > 1 && (
                    <Icon name="doc" size="var(--s-24)" />
                  )}
                  {w}
                </li>
              ))}
            </ul>
          </section>
          <Icon name="arrow" size="var(--s-40)" strokeWidth={3} className={styles.arrow} />
          <section aria-label="Suggested sentence" className={styles.suggest}>
            <p className={styles.kicker}>
              <Icon name="sparkle" size="var(--s-24)" />
              SUGGESTED SENTENCE
              <span className={styles.style}>{place} style</span>
            </p>
            <p className={styles.sentence}>{sentence}</p>
            <p className={styles.safe}>
              <Icon name="shield" size="var(--s-24)" />
              Nothing is shown to the other person until you say yes.
            </p>
            <ul className={styles.actions}>
              <Action className={`${styles.action} ${styles.yes}`} event={{ type: 'YES' }}>
                <HandGlyph
                  gesture="up"
                  height="max(40px, calc(var(--u) * 52))"
                  stroke="#fff"
                  label=""
                />
                Yes, use it
              </Action>
              <Action className={`${styles.action} ${styles.no}`} event={{ type: 'NO' }}>
                <HandGlyph
                  gesture="down"
                  height="max(40px, calc(var(--u) * 52))"
                  stroke="currentColor"
                  label=""
                />
                Try another
              </Action>
            </ul>
          </section>
        </div>
        <div className={styles.side}>
          <div className={styles.cam}>
            <CameraView label="Camera preview. Thumbs up uses the sentence, thumbs down tries another.">
              <Demo>
                <HandGlyph
                  gesture="up"
                  height="22cqw"
                  stroke="var(--teal-soft)"
                  dot="#fff"
                  label="Thumbs up detected"
                  className={styles.hand}
                />
              </Demo>
              <div className={styles.ring}>
                <CommandRing label="up" fallback={0.75} />
              </div>
              <CamPill style={{ left: '50%', bottom: '4%', top: 'auto' }}>
                Thumbs up = use it
              </CamPill>
            </CameraView>
          </div>
          <Card title="HOW TO ANSWER">
            <InfoList>
              <InfoRow icon="hand">Thumbs up: use this sentence.</InfoRow>
              <InfoRow icon="refresh">Thumbs down: try another wording.</InfoRow>
              <InfoRow icon="doc">Need to add more? Show a card or spell a word.</InfoRow>
            </InfoList>
          </Card>
        </div>
      </div>
    </Screen>
  );
}
