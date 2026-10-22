import type { ReactNode } from 'react';
import styles from './Message.module.css';

interface Props {
  /** text already confirmed (words and letters) */
  text: string;
  /** letter being recognised, shown in amber with an underline (colour is not the only cue) */
  candidate?: string | null;
  /** show the blinking-style caret bar */
  caret?: boolean;
  /** show this instead when there is no text at all */
  placeholder?: string;
  /** red underline for a word that is not in the list (screen 09) */
  flagged?: boolean;
  children?: ReactNode;
}

export function Message({ text, candidate, caret, placeholder, flagged, children }: Props) {
  const empty = !text && !candidate;
  return (
    <div className={styles.row}>
      {empty && placeholder ? (
        <>
          {caret && <span className={styles.caret} aria-hidden="true" />}
          <p className={styles.placeholder}>{placeholder}</p>
        </>
      ) : (
        <>
          {text && <p className={`${styles.letters} ${flagged ? styles.flagged : ''}`}>{text}</p>}
          {candidate && (
            <p className={`${styles.letters} ${styles.candidate}`}>
              <span aria-label={`Recognising ${candidate}`}>{candidate}</span>
            </p>
          )}
          {caret && <span className={styles.caret} aria-hidden="true" />}
        </>
      )}
      {children}
    </div>
  );
}
