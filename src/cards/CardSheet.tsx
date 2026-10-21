import { Icon } from '../ui/Icon';
import { CARD_PACKS } from '../screens/cardPack';
import styles from './CardSheet.module.css';

/**
 * Printable sheet of every card (`/?cards=print`, then Print). Each card shows its word and picture in
 * large print on white, one place per page. Print on card, cut out, and use the same cards when
 * photographing the training set (docs/CARDS.md): a detector only knows cards that look like these.
 */
export function CardSheet() {
  return (
    <div className={styles.sheet} data-testid="card-sheet">
      <header className={styles.top}>
        <h1>SignScribe picture cards</h1>
        <p>
          Print this page (landscape, no scaling), cut along the lines and keep each place together.
          The word under the picture is what the card adds to the message.
        </p>
      </header>
      {Object.entries(CARD_PACKS).map(([place, cards]) => (
        <section key={place} className={styles.page} aria-label={`${place} cards`}>
          <h2>{place}</h2>
          <ul className={styles.grid}>
            {cards.map((c) => (
              <li key={c.word} className={styles.card}>
                <Icon name={c.icon} size="60%" strokeWidth={5} />
                <span>{c.word}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
