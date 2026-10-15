import type { ReactNode } from 'react';
import { Chip } from '../ui/Chip';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { HoldRing } from '../ui/HoldRing';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { useCtx } from '../state/MachineProvider';
import common from './common.module.css';
import styles from './S05Method.module.css';
import { HandChip } from '../vision/bits';
import { Demo } from '../vision/bits';
import { useDwellTarget } from '../vision/targets';
import type { Method } from '../state/machine';

function Option({
  method,
  selected,
  art,
  title,
  text,
  pill,
}: {
  method: Method;
  selected: boolean;
  art: ReactNode;
  title: string;
  text: string;
  pill: string;
}) {
  const ref = useDwellTarget({ type: 'CHOOSE_METHOD', method });
  return (
    <li ref={ref} className={`${styles.card} ${selected ? styles.selected : ''}`}>
      <div className={styles.art}>{art}</div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{text}</p>
      <p className={styles.pill}>{pill}</p>
      {selected && (
        <Demo>
          <span className={styles.pointer}>
            <HoldRing progress={0.7} size="100%" tone="light" label="Hold to choose">
              <span className={styles.dot} />
            </HoldRing>
          </span>
        </Demo>
      )}
      <span className="sr-only">{selected ? 'Selected' : ''}</span>
    </li>
  );
}

export default function S05Method() {
  const { method, place } = useCtx();
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
          <Hint gesture="point" label="Point and hold: choose" suggested />
          <Hint gesture="up" label="Yes" />
          <Hint gesture="down" label="Back" />
        </>
      }
    >
      <div className={common.center}>
        <h1 className={common.h1}>How do you want to build your message?</h1>
        <p className={common.lede}>
          You can switch at any time. Both ways need only your hands and the camera.
        </p>
        <ul className={styles.options} aria-label="Ways to build a message">
          <Option
            method="spell"
            selected={method === 'spell'}
            art={
              <HandGlyph
                gesture="open"
                height="calc(var(--u) * 169)"
                stroke="var(--teal)"
                label=""
              />
            }
            title="Spell with signs"
            text="Sign letters one at a time. Works for any word, including names."
            pill="Best for names and new words"
          />
          <Option
            method="card"
            selected={method === 'card'}
            art={
              <div className={styles.cardArt}>
                <div className={styles.paper}>
                  <Icon name="cross" size="var(--s-72)" />
                </div>
                <span className={styles.box} />
                <span className={styles.tag}>Card 94%</span>
              </div>
            }
            title="Show a picture card"
            text="Hold up a printed card. Fast for common phrases."
            pill="Best for common phrases"
          />
        </ul>
      </div>
    </Screen>
  );
}
