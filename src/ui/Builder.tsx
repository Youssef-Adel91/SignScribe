import type { ReactNode } from 'react';
import styles from './Builder.module.css';

/** Two-column body of screens 06-10: camera on one side, message and help cards on the other. */
export function BuilderBody({
  camera,
  side,
  title,
}: {
  camera: ReactNode;
  side: ReactNode;
  title: string;
}) {
  return (
    <div className={styles.body}>
      <h1 className="sr-only">{title}</h1>
      <div className={styles.cam}>{camera}</div>
      <div className={styles.side}>{side}</div>
    </div>
  );
}
