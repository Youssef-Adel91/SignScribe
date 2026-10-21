import { useState } from 'react';
import { LETTERS } from '../collect/dataset';
import { useCtx, useScreenNumber, useSend } from '../state/MachineProvider';
import { CARD_PACKS } from '../screens/cardPack';
import styles from './DevPanel.module.css';

/**
 * Wizard-of-Oz (`?woz=1`): a facilitator types the letters the participant is signing, while the
 * participant still uses the real command zone and screens. For studies before a letter model exists.
 * It sends the same events the recogniser sends, so everything downstream is the real app.
 */
export function WozPanel() {
  const send = useSend();
  const screen = useScreenNumber();
  const { place } = useCtx();
  const [open, setOpen] = useState(true);
  if (!open)
    return (
      <button
        type="button"
        className={styles.reopen}
        style={{ left: 8, right: 'auto' }}
        onClick={() => setOpen(true)}
      >
        WoZ
      </button>
    );
  const spelling = screen === 6 || screen === 7;
  return (
    <aside
      className={styles.panel}
      style={{ left: 8, right: 'auto', bottom: 'auto', top: 8 }}
      aria-label="Wizard of Oz letters"
      data-testid="woz-panel"
    >
      <header>
        <strong>Wizard of Oz</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide">
          ×
        </button>
      </header>
      <p style={{ margin: '4px 0' }}>
        {spelling
          ? 'Click the letter the participant signs.'
          : 'Letters work on the spelling screens (06, 07).'}
      </p>
      {screen === 10 && (
        <fieldset>
          <legend>Card shown ({place})</legend>
          {CARD_PACKS[place].map((c) => (
            <button
              key={c.word}
              type="button"
              onClick={() => send({ type: 'CARD_ADDED', word: c.word.toUpperCase() })}
            >
              {c.word}
            </button>
          ))}
        </fieldset>
      )}
      <fieldset>
        <legend>Letter</legend>
        {LETTERS.map((l) => (
          <button
            key={l}
            type="button"
            disabled={!spelling}
            onClick={() => {
              send({
                type: 'LETTER_CANDIDATE',
                candidate: { letter: l, confidence: 1, alternatives: [] },
              });
              send({ type: 'LETTER_CONFIRMED', letter: l });
            }}
          >
            {l}
          </button>
        ))}
      </fieldset>
    </aside>
  );
}
