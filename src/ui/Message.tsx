import type { ReactNode } from 'react';
import { UNCONFIRMED_CLOSE, UNCONFIRMED_OPEN } from '../config/alphabet';
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
  /** ArSL: the text reads right to left (the caret and the rest of the row stay where they are) */
  rtl?: boolean;
  children?: ReactNode;
}

/** letters nobody has confirmed yet are written as ⟨id⟩: shown dashed, with the marks as the cue that is not colour */
function Marked({ text }: { text: string }) {
  const parts = text.split(
    new RegExp(`(${UNCONFIRMED_OPEN}[^${UNCONFIRMED_CLOSE}]*${UNCONFIRMED_CLOSE})`),
  );
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith(UNCONFIRMED_OPEN) ? (
          <span key={i} className={styles.unconfirmed} data-testid="unconfirmed-letter">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function Message({ text, candidate, caret, placeholder, flagged, rtl, children }: Props) {
  const dir = rtl ? ({ dir: 'rtl', lang: 'ar' } as const) : {};
  const empty = !text && !candidate;
  return (
    <div className={styles.row} {...dir}>
      {empty && placeholder ? (
        <>
          {caret && <span className={styles.caret} aria-hidden="true" />}
          {/* the placeholder is screen text, not the person's writing: it stays left to right */}
          <p className={styles.placeholder} dir="ltr" lang="en">
            {placeholder}
          </p>
        </>
      ) : (
        <>
          {text && (
            <p
              className={`${styles.letters} ${rtl ? styles.rtl : ''} ${flagged ? styles.flagged : ''}`}
            >
              <Marked text={text} />
            </p>
          )}
          {candidate && (
            <p className={`${styles.letters} ${rtl ? styles.rtl : ''} ${styles.candidate}`}>
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
