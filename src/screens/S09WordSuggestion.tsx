import { CamPill, CameraView } from '../ui/CameraView';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { CommandZone, SigningArea } from '../ui/CommandZone';
import { Hint } from '../ui/HintBar';
import { HoldRing } from '../ui/HoldRing';
import { Icon } from '../ui/Icon';
import { Message } from '../ui/Message';
import { BuilderBody } from '../ui/Builder';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { useCtx } from '../state/MachineProvider';
import styles from './S09WordSuggestion.module.css';

export default function S09WordSuggestion() {
  const { hand, place, suggestion } = useCtx();
  const original = suggestion?.original ?? '';
  const match = suggestion?.match ?? '';
  useAnnounceOnChange(
    match ? `Did you mean ${match}? ${original} is not in the ${place} word list.` : null,
  );
  return (
    <Screen
      steps={['done', 'active', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="gray">Context: {place}</Chip>
          <Chip kind="green">Hand detected</Chip>
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="up" label="Yes" suggested />
          <Hint gesture="down" label="No, keep my word" />
          <Hint gesture="fist" label="Delete letters" />
        </>
      }
    >
      <BuilderBody
        title="Did you mean this word?"
        camera={
          <CameraView label="Camera preview. Thumbs up in the command zone means yes.">
            <CommandZone signingHand={hand} active="Done" />
            <SigningArea signingHand={hand} />
            <div className={styles.ring}>
              <HoldRing progress={0.75} size="100%" label="Hold to confirm yes">
                <Icon name="check" size="40%" strokeWidth={3.2} />
              </HoldRing>
            </div>
            <CamPill style={{ left: '56%', bottom: '11.3%', top: 'auto' }}>
              Thumbs up in the command zone = Yes
            </CamPill>
          </CameraView>
        }
        side={
          <>
            <Card title="Your word">
              <div className={styles.word}>
                <Message text={original} flagged />
              </div>
            </Card>
            <section className={styles.suggest} aria-label="Suggestion">
              <p className={styles.kicker}>
                <Icon name="sparkle" size="var(--s-22)" />
                DID YOU MEAN
              </p>
              <p className={styles.match}>{match}</p>
              <p className={styles.why}>
                "{original}" is not in the {place} word list. "{match}" is the closest match.
              </p>
              <ul className={styles.hints}>
                <Hint gesture="up" label={`Yes, use ${match}`} suggested />
                <Hint gesture="down" label={`No, keep ${original}`} />
              </ul>
            </section>
          </>
        }
      />
    </Screen>
  );
}
