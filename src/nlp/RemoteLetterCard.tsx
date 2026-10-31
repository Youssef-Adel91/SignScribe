import { useEffect, useState } from 'react';
import { useAnnounceOnChange } from '../output/announcer';
import { onMachineEvent, useScreenNumber } from '../state/MachineProvider';
import { useDwellTarget } from '../vision/targets';
import { REMOTE_LETTER_MS, setLetter, subscribeLetter, type RemoteLetter } from './remoteLetter';
import styles from './RemoteLetterCard.module.css';

/**
 * On the spelling screens: a letter another program recognised (the dollarpy client) is offered here. It is added
 * only when the person points at it and holds, like everything else, and disappears after a few seconds.
 */
export function RemoteLetterCard() {
  const screen = useScreenNumber();
  const [item, setItem] = useState<RemoteLetter | null>(null);
  useEffect(() => subscribeLetter(setItem), []);
  // once the person has added it, the offer is gone: one recognition is one letter
  useEffect(
    () =>
      onMachineEvent((e) => {
        if (e.type === 'LETTER_ADD') setLetter(null);
      }),
    [],
  );
  const spelling = screen === 6 || screen === 7;
  const shown = spelling ? item : null;
  useEffect(() => {
    if (!item) return;
    const t = setTimeout(
      () => setLetter(null),
      Math.max(0, item.at + REMOTE_LETTER_MS - Date.now()),
    );
    return () => clearTimeout(t);
  }, [item]);
  // adding it clears the offer, so the same letter cannot be added twice by one recognition
  useEffect(() => {
    if (screen !== 6 && screen !== 7 && item) setLetter(null);
  }, [screen, item]);
  const ref = useDwellTarget(shown ? { type: 'LETTER_ADD', letter: shown.letter } : null);
  const text = shown
    ? `${shown.source} recognised ${shown.letter}${shown.demo ? ' (simulated)' : ''}. Point and hold here to add it.`
    : null;
  useAnnounceOnChange(text);
  if (!shown) return null;
  return (
    <div ref={ref} className={styles.card} data-testid="remote-letter" role="status">
      <span className={styles.letter} aria-hidden="true">
        {shown.letter}
      </span>
      <span className={styles.text}>
        <strong>
          {shown.source}: {shown.letter}
          {shown.demo ? ' (simulated)' : ''}
        </strong>
        <span>Point and hold here to add it</span>
      </span>
    </div>
  );
}
