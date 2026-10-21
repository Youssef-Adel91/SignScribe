import { CamPill, CameraView } from '../ui/CameraView';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { CommandZone, SigningArea } from '../ui/CommandZone';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { HoldRing } from '../ui/HoldRing';
import { Message } from '../ui/Message';
import { BuilderBody } from '../ui/Builder';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { useCtx } from '../state/MachineProvider';
import styles from './S07SpellRecognizing.module.css';
import { HandChip } from '../vision/bits';
import { Demo } from '../vision/bits';
import { LiveLetterRing } from '../recognition/LiveLetterRing';

export default function S07SpellRecognizing() {
  const { hand, place, words, word, candidate } = useCtx();
  const text = [...words, word].filter(Boolean).join(' ');
  const letter = candidate?.letter ?? '';
  const caption = `Looks like "${letter}". Hold still…`;
  useAnnounceOnChange(letter ? caption : null);
  const guesses = candidate
    ? [{ letter: candidate.letter, confidence: candidate.confidence }, ...candidate.alternatives]
    : [];
  return (
    <Screen
      steps={['done', 'active', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="gray">Context: {place}</Chip>
          <HandChip />
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="open" label="Space" />
          <Hint gesture="fist" label="Delete" />
          <Hint gesture="up" label="Done" />
          <Hint gesture="down" label="Cancel" />
        </>
      }
    >
      <BuilderBody
        title="Recognising a letter"
        camera={
          <CameraView label={`Camera preview. Recognising the letter ${letter}.`}>
            <CommandZone signingHand={hand} />
            <SigningArea signingHand={hand} />
            <Demo>
              <HandGlyph
                gesture="point"
                height="30.9cqw"
                stroke="var(--teal-soft)"
                dot="#fff"
                label="Your signing hand"
                className={styles.hand}
              />
              <div className={styles.ring}>
                {/* progress is a static design value until the dwell engine exists (Phase 2) */}
                <HoldRing progress={0.75} size="100%" label={`Hold to confirm ${letter}`}>
                  <span className={styles.letter}>{letter}</span>
                </HoldRing>
              </div>
            </Demo>
            <LiveLetterRing />
            <CamPill style={{ bottom: '11.3%', top: 'auto' }}>{caption}</CamPill>
          </CameraView>
        }
        side={
          <>
            <Card title="Your message">
              <Message text={text} candidate={letter} caret />
            </Card>
            <Card title="Not right? Other guesses">
              <ul className={styles.guesses}>
                {guesses.map((g, i) => (
                  <li key={g.letter} className={`${styles.guess} ${i === 0 ? styles.top : ''}`}>
                    <span className={styles.gl}>{g.letter}</span>
                    <span className={styles.gp}>{Math.round(g.confidence * 100)}%</span>
                    {i === 0 && <span className="sr-only"> (best guess)</span>}
                  </li>
                ))}
              </ul>
              <p className={styles.note}>Change your sign slightly and the guess updates.</p>
            </Card>
            <Card title="Confirm time">
              <div className={styles.time}>
                <p className={styles.big}>0.8 s</p>
                <p className={styles.note}>
                  Adapts to you: shorter when you are accurate, longer after mistakes.
                </p>
              </div>
            </Card>
          </>
        }
      />
    </Screen>
  );
}
