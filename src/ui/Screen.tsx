import type { ReactNode } from 'react';
import { HintBar } from './HintBar';
import { TopBar, type StepStates } from './TopBar';
import styles from './Screen.module.css';

/** Landmarks for every screen: banner (top bar), one main region, gesture hints as the footer. */
export function Screen({
  steps,
  chips,
  hints,
  children,
  mainClass = '',
}: {
  steps?: StepStates;
  chips: ReactNode;
  hints: ReactNode;
  children: ReactNode;
  mainClass?: string;
}) {
  return (
    <div className={styles.screen}>
      <TopBar steps={steps}>{chips}</TopBar>
      <main className={`${styles.main} ${mainClass}`} id="main">
        {children}
      </main>
      <HintBar>{hints}</HintBar>
    </div>
  );
}
