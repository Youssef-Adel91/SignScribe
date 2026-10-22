import { useState } from 'react';
import { Overlay } from '../ui/Overlay';
import { CONSENT_TEXT, PROFILE, profileComplete, type ProfileAnswers } from './profile';
import styles from './Study.module.css';

/** Background questions and the consent line, before the first task. The facilitator reads and ticks. */
export function ProfileForm({
  participant,
  onSubmit,
}: {
  participant: number;
  onSubmit: (a: ProfileAnswers) => void;
}) {
  const [a, setA] = useState<Partial<ProfileAnswers>>({});
  const [consent, setConsent] = useState(false);
  const left = PROFILE.filter((q) => a[q.id] === undefined).length;
  const ok = profileComplete(a) && consent;
  return (
    <Overlay>
      <main className={styles.page}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (profileComplete(a) && consent) onSubmit(a);
          }}
        >
          <h1>Before we start (participant {participant})</h1>
          <p>A few questions about you. Choose the answer that fits best.</p>
          {PROFILE.map((q) => (
            <fieldset key={q.id} className={styles.q}>
              <legend>{q.text}</legend>
              <div className={styles.scale} role="radiogroup">
                {q.options.map((o) => (
                  <label key={o.value}>
                    <input
                      type="radio"
                      name={q.id}
                      value={o.value}
                      checked={a[q.id] === o.value}
                      onChange={() => setA({ ...a, [q.id]: o.value })}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <label
            className={styles.q}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 6 }}
            />
            <span style={{ fontWeight: 400 }}>{CONSENT_TEXT}</span>
          </label>
          <button type="submit" disabled={!ok}>
            {left > 0
              ? `${left} question${left === 1 ? '' : 's'} left`
              : consent
                ? 'Start'
                : 'Tick the consent line'}
          </button>
        </form>
      </main>
    </Overlay>
  );
}
