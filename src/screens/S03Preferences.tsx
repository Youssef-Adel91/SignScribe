import { Chip } from '../ui/Chip';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { Screen } from '../ui/Screen';
import { Tile } from '../ui/Tile';
import { useCtx } from '../state/MachineProvider';
import { AVAILABLE_ALPHABETS, type Alphabet, type Display } from '../state/machine';
import common from './common.module.css';
import styles from './S03Preferences.module.css';
import { HandChip } from '../vision/bits';

const ALPHABETS: { key: Alphabet; title: string; sub: string }[] = [
  { key: 'arabic', title: 'Arabic', sub: 'ArSL letters' },
  { key: 'english', title: 'English', sub: 'Fingerspelling' },
  { key: 'more', title: 'More…', sub: 'Other alphabets' },
];
const DISPLAYS: { key: Display; title: string; sub: string }[] = [
  { key: 'standard', title: 'Standard', sub: 'Normal size and colours' },
  { key: 'large', title: 'Large text', sub: 'Bigger words everywhere' },
  { key: 'contrast', title: 'High contrast', sub: 'Large text, strong colours' },
];

export default function S03Preferences() {
  const { hand, alphabet, display } = useCtx();
  return (
    <Screen
      steps={['active', 'todo', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="green">Camera on</Chip>
          <HandChip />
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="point" label="Point and hold: choose" suggested />
          <Hint gesture="up" label="Continue" />
          <Hint gesture="down" label="Back" />
        </>
      }
    >
      <div className={common.center}>
        <h1 className={common.h1}>Three quick choices</h1>
        <p className={common.lede}>
          Point at a choice and hold still. The ring shows when it is chosen.
        </p>

        <h2 className={common.h2} id="q-hand">
          Which hand do you sign with?
        </h2>
        <ul className={common.row} aria-labelledby="q-hand">
          <Tile
            selected={hand === 'left'}
            title="Left hand"
            size="sm"
            className={styles.hand}
            dwell={{ type: 'CHOOSE_HAND', hand: 'left' }}
          >
            <HandGlyph
              gesture="openLeft"
              height="calc(var(--u) * 110)"
              stroke={hand === 'left' ? 'var(--teal)' : 'var(--muted-2)'}
              label=""
            />
          </Tile>
          <Tile
            selected={hand === 'right'}
            title="Right hand"
            size="sm"
            className={styles.hand}
            dwell={{ type: 'CHOOSE_HAND', hand: 'right' }}
          >
            <HandGlyph
              gesture="open"
              height="calc(var(--u) * 110)"
              stroke={hand === 'right' ? 'var(--teal)' : 'var(--muted-2)'}
              label=""
            />
          </Tile>
        </ul>

        <h2 className={common.h2} id="q-alpha">
          Which sign alphabet?
        </h2>
        <ul className={common.row} aria-labelledby="q-alpha">
          {ALPHABETS.map((a) => (
            <Tile
              key={a.key}
              selected={alphabet === a.key}
              unavailable={!AVAILABLE_ALPHABETS.includes(a.key)}
              title={a.title}
              sub={a.sub}
              className={styles.small}
              dwell={{ type: 'CHOOSE_ALPHABET', alphabet: a.key }}
            />
          ))}
        </ul>

        <h2 className={common.h2} id="q-display">
          How should the screen look?
        </h2>
        <ul className={common.row} aria-labelledby="q-display">
          {DISPLAYS.map((d) => (
            <Tile
              key={d.key}
              selected={display === d.key}
              title={d.title}
              sub={d.sub}
              className={styles.small}
              dwell={{ type: 'CHOOSE_DISPLAY', display: d.key }}
            />
          ))}
        </ul>
      </div>
    </Screen>
  );
}
