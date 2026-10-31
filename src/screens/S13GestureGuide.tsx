import { Chip } from '../ui/Chip';
import { HandGlyph, type Glyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { Screen } from '../ui/Screen';
import { AboutCredits } from '../ui/AboutCredits';
import { useAnnounceOnChange } from '../output/announcer';
import { useStrings } from '../output/strings';
import styles from './S13GestureGuide.module.css';

const GESTURES: { title: string; glyph: Glyph; both?: boolean; text: string; tag: string }[] = [
  {
    title: 'Space',
    glyph: 'open',
    text: 'Open palm in the command zone. Hold 0.5 s.',
    tag: 'Starts a new word',
  },
  {
    title: 'Delete',
    glyph: 'fist',
    text: 'Fist in the command zone. Removes the last letter.',
    tag: 'Undo is offered',
  },
  {
    title: 'Yes / Done',
    glyph: 'up',
    text: 'Thumbs up. Confirms a suggestion or finishes.',
    tag: 'Same on every screen',
  },
  {
    title: 'No / Cancel',
    glyph: 'down',
    text: 'Thumbs down. Rejects a suggestion or goes back.',
    tag: 'Same on every screen',
  },
  {
    title: 'Choose',
    glyph: 'point',
    text: 'Point at a button and hold until the ring fills.',
    tag: 'Menus and options',
  },
  {
    title: 'Help',
    glyph: 'open',
    both: true,
    text: 'Raise both open hands to open this guide.',
    tag: 'Works on any screen',
  },
];

export default function S13GestureGuide() {
  const strings = useStrings();
  useAnnounceOnChange(strings.gestureGuideOpen);
  return (
    <Screen
      chips={
        <>
          <Chip kind="gray">Help open</Chip>
          <Chip kind="gray">Both hands up: Close</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="up" label="Close help" suggested />
          <Hint gesture="point" label="Point and hold: choose" />
        </>
      }
      mainClass={styles.main}
    >
      <h1 className={styles.h1}>Gesture guide</h1>
      <p className={styles.lede}>
        Show these hand shapes in the command zone, or point and hold on a button. The same gesture
        always means the same thing.
      </p>
      <ul className={styles.grid}>
        {GESTURES.map((g) => (
          <li key={g.title} className={styles.card}>
            <span className={styles.hands}>
              {g.both && (
                <HandGlyph
                  gesture="openLeft"
                  height="max(60px, calc(var(--u) * 91))"
                  stroke="var(--teal)"
                  label="Left open hand"
                />
              )}
              <HandGlyph
                gesture={g.glyph}
                height={
                  g.both ? 'max(60px, calc(var(--u) * 91))' : 'max(72px, calc(var(--u) * 125))'
                }
                stroke="var(--teal)"
                label={g.both ? 'Right open hand' : undefined}
              />
            </span>
            <span className={styles.txt}>
              <h2 className={styles.title}>{g.title}</h2>
              <p className={styles.desc}>{g.text}</p>
              <span className={styles.tag}>{g.tag}</span>
            </span>
          </li>
        ))}
      </ul>
      <AboutCredits />
    </Screen>
  );
}
