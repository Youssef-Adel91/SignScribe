import { CREDITS, LICENCE_TEXT } from '../config/credits';
import styles from './AboutCredits.module.css';

/** "About and credits": who made the data the letter models learned from, under which licence, and what was changed. */
export function AboutCredits() {
  return (
    <section className={styles.about} aria-labelledby="about-credits" data-testid="about-credits">
      <h2 className={styles.title} id="about-credits">
        About and credits
      </h2>
      <p className={styles.text}>
        Letter models made with open data:{' '}
        {CREDITS.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ' '}
            <strong>{c.name}</strong>, {c.licence}: {c.use}. Changes: {c.changes}.
          </span>
        ))}{' '}
        Licence text: {LICENCE_TEXT}. Full credit: docs/CREDITS.md.
      </p>
    </section>
  );
}
