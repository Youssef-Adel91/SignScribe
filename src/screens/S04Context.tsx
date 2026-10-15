import { Chip } from '../ui/Chip';
import { Hint } from '../ui/HintBar';
import { HoldRing } from '../ui/HoldRing';
import { Icon, type IconName } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { Tile } from '../ui/Tile';
import { useCtx } from '../state/MachineProvider';
import type { Place } from '../nlp/words';
import common from './common.module.css';
import styles from './S04Context.module.css';

const PLACES: { key: Place; sub: string; icon: IconName }[] = [
  { key: 'Clinic', sub: 'doctor · pain · medicine', icon: 'cross' },
  { key: 'Shop', sub: 'price · size · pay', icon: 'bag' },
  { key: 'Work', sub: 'meeting · help · thanks', icon: 'briefcase' },
  { key: 'Home', sub: 'family · food · water', icon: 'home' },
];

export default function S04Context() {
  const { place } = useCtx();
  return (
    <Screen
      steps={['active', 'todo', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="green">Camera on</Chip>
          <Chip kind="green">Hand detected</Chip>
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
        <h1 className={common.h1}>Where are you today?</h1>
        <p className={common.lede}>
          SignScribe prepares words, picture cards and sentence styles for this place.
        </p>
        <ul className={`${common.row} ${styles.row}`} aria-label="Places">
          {PLACES.map((p) => {
            const on = p.key === place;
            return (
              <Tile
                key={p.key}
                selected={on}
                title={p.key}
                sub={p.sub}
                size="md"
                className={styles.tile}
              >
                <span className={`${styles.disc} ${on ? styles.discOn : ''}`}>
                  <Icon name={p.icon} size="var(--s-44)" />
                </span>
                {on && (
                  <span className={styles.pointer}>
                    <HoldRing progress={0.7} size="100%" tone="light" label="Hold to choose">
                      <span className={styles.dot} />
                    </HoldRing>
                  </span>
                )}
              </Tile>
            );
          })}
        </ul>
      </div>
    </Screen>
  );
}
