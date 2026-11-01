import { loadProfile } from '../state/profiles';
import { useState } from 'react';
import { SCREEN_NAMES, type Ev } from '../state/machine';
import { useCtx, useScreenNumber, useSend } from '../state/MachineProvider';
import styles from './DevPanel.module.css';

const cand = (letter: string): Ev => ({
  type: 'LETTER_CANDIDATE',
  candidate: { letter, confidence: 0.87, alternatives: [{ letter: 'I', confidence: 0.08 }] },
});

/**
 * Developer simulator, mounted only with ?dev=1. It stands in for the camera: each button sends the
 * same machine event that a recognised gesture will send in Phase 2. The real app has no such buttons.
 */
export function DevPanel({ goTo }: { goTo: (screen: number) => void }) {
  const send = useSend();
  const ctx = useCtx();
  const screen = useScreenNumber();
  const [open, setOpen] = useState(true);
  const b = (label: string, e: Ev) => (
    <button key={label} type="button" onClick={() => send(e)}>
      {label}
    </button>
  );
  if (!open) {
    return (
      <button type="button" className={styles.reopen} onClick={() => setOpen(true)}>
        Dev
      </button>
    );
  }
  return (
    <aside className={styles.panel} aria-label="Developer simulator">
      <header>
        <strong>Dev simulator</strong>
        <span>
          {' '}
          screen {screen}: {SCREEN_NAMES[screen - 1]}
        </span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide simulator">
          ×
        </button>
      </header>
      <fieldset>
        <legend>Go to screen</legend>
        {SCREEN_NAMES.map((n, i) => (
          <button key={n} type="button" onClick={() => goTo(i + 1)} title={n}>
            {i + 1}
          </button>
        ))}
      </fieldset>
      <fieldset>
        <legend>Gestures</legend>
        {b('Wake (open hand 2 s)', { type: 'WAKE' })}
        {b('Thumbs up', { type: 'YES' })}
        {b('Thumbs down', { type: 'NO' })}
        {b('Open palm: Space', { type: 'SPACE' })}
        {b('Fist: Delete', { type: 'DELETE' })}
        {b('Both hands: Help', { type: 'HELP_TOGGLE' })}
        {b('Hand lost', { type: 'HAND_LOST' })}
        {b('Hand back', { type: 'HAND_BACK' })}
      </fieldset>
      <fieldset>
        <legend>Point and hold</legend>
        {b('Checks passed', { type: 'CHECKS_PASSED' })}
        {b('Left hand', { type: 'CHOOSE_HAND', hand: 'left' })}
        {b('Right hand', { type: 'CHOOSE_HAND', hand: 'right' })}
        {b('Arabic', { type: 'CHOOSE_ALPHABET', alphabet: 'arabic' })}
        {b('English', { type: 'CHOOSE_ALPHABET', alphabet: 'english' })}
        {b('Profile male', { type: 'CHOOSE_GENDER', gender: 'male' })}
        {b('Profile female', { type: 'CHOOSE_GENDER', gender: 'female' })}
        {b('Profile not set', { type: 'CHOOSE_GENDER', gender: 'unset' })}
        {b('Text normal', { type: 'CHOOSE_TEXT_SIZE', textSize: 'normal' })}
        {b('Text large', { type: 'CHOOSE_TEXT_SIZE', textSize: 'large' })}
        {b('Text extra large', { type: 'CHOOSE_TEXT_SIZE', textSize: 'xlarge' })}
        {b('Contrast standard', { type: 'CHOOSE_CONTRAST', contrast: 'standard' })}
        {b('Contrast high', { type: 'CHOOSE_CONTRAST', contrast: 'high' })}
        {b('Hold auto', { type: 'CHOOSE_DWELL', dwell: 'auto' })}
        {b('Hold slow', { type: 'CHOOSE_DWELL', dwell: 'slow' })}
        {b('Hold fast', { type: 'CHOOSE_DWELL', dwell: 'fast' })}
        {b('Voice on', { type: 'CHOOSE_VOICE', voice: true })}
        {b('Voice off', { type: 'CHOOSE_VOICE', voice: false })}
        {(['Clinic', 'Shop', 'Work', 'Home'] as const).map((p) =>
          b(p, { type: 'CHOOSE_CONTEXT', place: p }),
        )}
        {b('Spell', { type: 'CHOOSE_METHOD', method: 'spell' })}
        {b('Picture cards', { type: 'CHOOSE_METHOD', method: 'card' })}
      </fieldset>
      <fieldset>
        <legend>Bluetooth context (simulated)</legend>
        {b('Detect youssef · Clinic', {
          type: 'CONTEXT_DETECTED',
          userId: 'youssef',
          place: 'Clinic',
          demo: true,
          profile: loadProfile('youssef'),
        })}
        {b('Detect sara · Shop', {
          type: 'CONTEXT_DETECTED',
          userId: 'sara',
          place: 'Shop',
          demo: true,
          profile: loadProfile('sara'),
        })}
        {b('Detect Work beacon only', {
          type: 'CONTEXT_DETECTED',
          userId: null,
          place: 'Work',
          demo: true,
        })}
        {b('Nothing detected', { type: 'CONTEXT_CLEARED' })}
      </fieldset>
      <fieldset>
        <legend>Letters ({ctx.word || 'empty'})</legend>
        {'HELOWIN'.split('').map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              send(cand(l));
              send({ type: 'LETTER_CONFIRMED', letter: l });
            }}
          >
            {l}
          </button>
        ))}
        {b('Candidate E', cand('E'))}
        {b('Candidate lost', { type: 'CANDIDATE_LOST' })}
        {b('Accept word', { type: 'WORD_ACCEPT' })}
        {b('Reject word', { type: 'WORD_REJECT' })}
      </fieldset>
      <fieldset>
        <legend>Cards</legend>
        {['HELLO', 'I', 'NEED', 'DOCTOR', 'PAIN'].map((w) =>
          b(`Add ${w}`, { type: 'CARD_ADDED', word: w }),
        )}
        {b('Show DOCTOR card', {
          type: 'CARD_CANDIDATE',
          candidate: { word: 'DOCTOR', confidence: 0.94, trackId: 1 },
        })}
        {b('Card lost', { type: 'CARD_LOST' })}
      </fieldset>
      <fieldset>
        <legend>Share</legend>
        {b('Finish', { type: 'FINISH' })}
        {b('New sentence', { type: 'NEW_SENTENCE' })}
        {b('Edit', { type: 'EDIT' })}
      </fieldset>
    </aside>
  );
}
