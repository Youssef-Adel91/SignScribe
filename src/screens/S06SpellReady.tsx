import { CamPill } from '../ui/CameraView';
import { CameraView } from '../ui/CameraView';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { CommandZone, SigningArea } from '../ui/CommandZone';
import { Hint } from '../ui/HintBar';
import { InfoList, InfoRow } from '../ui/InfoRow';
import { Message } from '../ui/Message';
import { BuilderBody } from '../ui/Builder';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { useCtx } from '../state/MachineProvider';

export default function S06SpellReady() {
  const { hand, place, words, word } = useCtx();
  const text = [...words, word].filter(Boolean).join(' ');
  const caption = text ? 'Show your next letter' : 'Show your first letter';
  useAnnounceOnChange(caption);
  return (
    <Screen
      steps={['done', 'active', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="gray">Context: {place}</Chip>
          <Chip kind="amber">Waiting for a hand</Chip>
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
        title="Spell your message"
        camera={
          <CameraView label="Camera preview. Waiting for your hand.">
            <CommandZone signingHand={hand} />
            <SigningArea signingHand={hand} />
            <CamPill style={{ bottom: '11.3%', top: 'auto' }}>{caption}</CamPill>
          </CameraView>
        }
        side={
          <>
            <Card title="Your message">
              <Message text={text} caret placeholder="Your letters will appear here" />
            </Card>
            <Card title="How it works">
              <InfoList>
                <InfoRow icon="hand">Sign a letter and hold it still until the ring fills.</InfoRow>
                <InfoRow icon="move">Use the command zone for space, delete and done.</InfoRow>
                <InfoRow icon="help">Stuck? Raise both hands for help.</InfoRow>
              </InfoList>
            </Card>
          </>
        }
      />
    </Screen>
  );
}
