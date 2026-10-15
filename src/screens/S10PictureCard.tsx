import { CamPill, CameraView } from '../ui/CameraView';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { CommandZone } from '../ui/CommandZone';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { HoldRing } from '../ui/HoldRing';
import { Icon, type IconName } from '../ui/Icon';
import { BuilderBody } from '../ui/Builder';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { useCtx } from '../state/MachineProvider';
import { CARD_PACKS, cardFor } from './cardPack';
import styles from './S10PictureCard.module.css';
import { useDwellTarget } from '../vision/targets';

const pretty = (w: string) => (w === 'I' ? 'I' : w.toLowerCase());
/** "I" + "need" read as one phrase chip, like the design. */
function group(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i] === 'I' && words[i + 1]) {
      out.push(`I ${pretty(words[i + 1])}`);
      i++;
    } else out.push(pretty(words[i]));
  }
  return out;
}

/** A card in the pack. Pointing at it and holding adds it, for people who cannot hold a printed card. */
function PackCell({ word, icon, on }: { word: string; icon: IconName; on: boolean }) {
  const ref = useDwellTarget({ type: 'CARD_ADDED', word: word.toUpperCase() });
  return (
    <li ref={ref} className={`${styles.cell} ${on ? styles.on : ''}`}>
      <Icon name={icon} size="var(--s-32)" strokeWidth={3} />
      <span>{word}</span>
    </li>
  );
}

export default function S10PictureCard() {
  const { hand, place, words, cardCandidate } = useCtx();
  const cand = cardCandidate;
  const def = cand ? cardFor(place, cand.word) : undefined;
  const pct = cand ? Math.round(cand.confidence * 100) : 0;
  const caption = cand
    ? `Hold the card still to add "${cand.word.toLowerCase()}"`
    : 'Show a picture card';
  useAnnounceOnChange(caption);
  const pack = CARD_PACKS[place];
  return (
    <Screen
      steps={['done', 'active', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="gray">Context: {place}</Chip>
          <Chip kind="gray">Mode: Picture cards</Chip>
          <Chip kind={cand ? 'green' : 'amber'}>
            {cand ? 'Card detected' : 'Waiting for a card'}
          </Chip>
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="open" label="Hold a card: add" suggested />
          <Hint gesture="up" label="Done" />
          <Hint gesture="down" label="Cancel" />
        </>
      }
    >
      <BuilderBody
        title="Show a picture card"
        camera={
          <CameraView
            label={
              cand
                ? `Camera preview. ${cand.word} card detected, ${pct} percent.`
                : 'Camera preview. Waiting for a card.'
            }
          >
            <CommandZone signingHand={hand} />
            {cand && (
              <>
                <div className={styles.paper}>
                  {def && <Icon name={def.icon} size="42%" strokeWidth={7} />}
                  <span className={styles.paperText}>{def?.word ?? cand.word}</span>
                </div>
                <HandGlyph
                  gesture="fist"
                  height="19.5cqw"
                  stroke="var(--teal-soft)"
                  dot="#fff"
                  label="Hand holding the card"
                  className={styles.hand}
                />
                <div className={styles.box} />
                <CamPill tone="green" style={{ left: '46%', top: '21.7%' }}>
                  {def?.word ?? cand.word} card · {pct}%
                </CamPill>
                <CamPill
                  style={{ left: '62.5%', top: '73.3%', transform: 'none', padding: '4px 10px' }}
                >
                  Tracking #{cand.trackId}
                </CamPill>
                <div className={styles.ring}>
                  <HoldRing progress={0.75} size="100%" label={`Hold to add ${cand.word}`}>
                    <Icon name="check" size="40%" strokeWidth={3.2} />
                  </HoldRing>
                </div>
              </>
            )}
            <CamPill style={{ left: '56%', bottom: '3.3%', top: 'auto' }}>{caption}</CamPill>
          </CameraView>
        }
        side={
          <>
            <Card title="Your message">
              <ul className={styles.msg}>
                {group(words).map((w, i) => (
                  <li key={`${w}-${i}`} className={styles.chip}>
                    <Icon name="doc" size="var(--s-20)" />
                    {w}
                  </li>
                ))}
                {cand && (
                  <li className={`${styles.chip} ${styles.ghost}`}>
                    {cand.word.toLowerCase()}
                    <span className="sr-only"> (not added yet, keep holding the card)</span>
                  </li>
                )}
              </ul>
            </Card>
            <Card title={`${place} cards`}>
              <ul className={styles.grid}>
                {pack.map((c) => (
                  <PackCell
                    key={c.word}
                    word={c.word}
                    icon={c.icon}
                    on={cand?.word.toLowerCase() === c.word.toLowerCase()}
                  />
                ))}
              </ul>
            </Card>
          </>
        }
      />
    </Screen>
  );
}
