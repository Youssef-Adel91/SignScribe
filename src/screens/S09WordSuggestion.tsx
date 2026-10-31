import { CamPill, CameraView } from '../ui/CameraView';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { CommandZone, SigningArea } from '../ui/CommandZone';
import { Hint } from '../ui/HintBar';
import { Icon } from '../ui/Icon';
import { Message } from '../ui/Message';
import { BuilderBody } from '../ui/Builder';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { useCtx } from '../state/MachineProvider';
import { useStrings } from '../output/strings';
import styles from './S09WordSuggestion.module.css';
import { HandChip } from '../vision/bits';
import { CommandRing } from '../vision/bits';

export default function S09WordSuggestion() {
  const { hand, place, suggestion } = useCtx();
  const strings = useStrings();
  const original = suggestion?.original ?? '';
  const match = suggestion?.match ?? '';
  useAnnounceOnChange(match ? strings.wordSuggestionAnnounce(match, original, place) : null);
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
              <CommandRing label="up" fallback={0.75} />
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
              <p className={styles.warn}>
                <Icon name="warn" size="var(--s-20)" />
                Not in the {place} word list
              </p>
            </Card>
            <Card title="Suggested word">
              <div className={styles.word}>
                <Message text={match} />
              </div>
              <p className={styles.caption}>Matches your letters best</p>
            </Card>
          </>
        }
      />
    </Screen>
  );
}
