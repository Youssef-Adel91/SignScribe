import { useEffect, useState } from 'react';
import { CamPill, CameraView } from '../ui/CameraView';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { CommandZone } from '../ui/CommandZone';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { Icon } from '../ui/Icon';
import { InfoList, InfoRow } from '../ui/InfoRow';
import { Message } from '../ui/Message';
import { BuilderBody } from '../ui/Builder';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { useCtx } from '../state/MachineProvider';
import { visionStore } from '../vision/store';
import styles from './S08HandLost.module.css';

/** how long the hand may stay away before the screen also suggests what to check (a person may just have lowered it) */
export const HAND_LOST_TIP_MS = 10_000;

export default function S08HandLost() {
  const { hand, place, words, word } = useCtx();
  const [late, setLate] = useState(false);
  // counted on the camera's own clock (frame times), so it follows the pictures and not the wall clock
  useEffect(() => {
    let since: number | null = null;
    return visionStore.subscribe(() => {
      const f = visionStore.state.frame;
      if (!f) return;
      since ??= f.t;
      if (f.t - since >= HAND_LOST_TIP_MS) setLate(true);
    });
  }, []);
  useAnnounceOnChange(
    late ? 'Still no hand. Check that nothing covers the camera and that there is light.' : null,
  );
  const text = [...words, word].filter(Boolean).join(' ');
  useAnnounceOnChange(
    "We lost your hand. Bring it back into the frame. Your message is safe. I can't see your hand.",
  );
  return (
    <Screen
      steps={['done', 'active', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="gray">Context: {place}</Chip>
          <Chip kind="amber">No hand: paused</Chip>
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        // while the hand is lost the command gestures do nothing, so they are not offered: the only way on is the hand
        <Hint gesture="open" label="Bring your hand back" suggested />
      }
    >
      <BuilderBody
        title="Hand lost, spelling paused"
        camera={
          <CameraView label="Camera preview. No hand found.">
            <div className={styles.dim} />
            <CommandZone signingHand={hand} idle />
            <HandGlyph
              gesture="open"
              height="27.6cqw"
              stroke="#94a3b8"
              dot="#cbd5e1"
              label="Where your hand should be"
              className={styles.hand}
            />
            <div className={styles.banner} role="alert">
              <Icon name="warn" size="var(--s-44)" />
              <p className={styles.bt}>We lost your hand</p>
              <p className={styles.bs}>Bring it back into the frame. Your message is safe.</p>
            </div>
            <CamPill style={{ left: '69%', bottom: '3%', top: 'auto' }}>Put your hand here</CamPill>
          </CameraView>
        }
        side={
          <>
            <Card title="Your message">
              <Message text={text}>
                <span className={styles.paused}>Paused</span>
              </Message>
            </Card>
            <Card title="What happens now">
              <InfoList>
                <InfoRow icon="check">Nothing is deleted. Spelling is paused.</InfoRow>
                <InfoRow icon="refresh">The ring restarts when your hand is back.</InfoRow>
                <InfoRow icon="speaker">Also spoken: "I can't see your hand."</InfoRow>
                {late && (
                  <InfoRow icon="warn">
                    Still no hand? Check that nothing covers the camera and that there is light.
                  </InfoRow>
                )}
              </InfoList>
            </Card>
          </>
        }
      />
    </Screen>
  );
}
