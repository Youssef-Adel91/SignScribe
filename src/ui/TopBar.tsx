import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './TopBar.module.css';

export type StepState = 'done' | 'active' | 'todo';
export type StepStates = [StepState, StepState, StepState, StepState];
const LABELS = ['Setup', 'Build', 'Review', 'Share'] as const;
const SPOKEN: Record<StepState, string> = {
  done: 'done',
  active: 'current step',
  todo: 'not started',
};

export function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.logo}>
        <Icon name="brand" size="var(--s-22)" strokeWidth={1.9} />
      </span>
      <span className={styles.name}>SignScribe</span>
    </div>
  );
}

/** Progress. The current step has three cues: colour, bold + underline, and aria-current="step". */
export function Stepper({ states }: { states: StepStates }) {
  return (
    <nav aria-label="Progress">
      <ol className={styles.steps}>
        {states.map((st, i) => (
          <li
            key={LABELS[i]}
            className={`${styles.step} ${styles[st]}`}
            aria-current={st === 'active' ? 'step' : undefined}
          >
            <span className={styles.badge}>
              {st === 'done' ? (
                <Icon name="stepCheck" size="var(--s-14)" strokeWidth={2.2} />
              ) : (
                i + 1
              )}
            </span>
            <span className={styles.label}>{LABELS[i]}</span>
            <span className="sr-only">, {SPOKEN[st]}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function TopBar({ steps, children }: { steps?: StepStates; children: ReactNode }) {
  return (
    <header className={styles.bar}>
      <Brand />
      {steps ? <Stepper states={steps} /> : <span />}
      <ul className={styles.chips} aria-label="Status">
        {children}
      </ul>
    </header>
  );
}
