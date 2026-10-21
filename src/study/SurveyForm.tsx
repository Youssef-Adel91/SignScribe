import { useState } from 'react';
import { MODE_LABEL, type Mode } from './design';
import {
  COMPARISON,
  ITEMS,
  LIKERT,
  comparisonOptions,
  isComplete,
  type Answers,
  type Preference,
} from './survey';
import styles from './Study.module.css';

/** After each method: the same closed questions, the same five balanced choices, a neutral middle. */
export function SurveyForm({ mode, onSubmit }: { mode: Mode; onSubmit: (a: Answers) => void }) {
  const [a, setA] = useState<Partial<Answers>>({});
  const left = ITEMS.filter((i) => a[i.id] === undefined).length;
  return (
    <form
      className={styles.page}
      onSubmit={(e) => {
        e.preventDefault();
        if (isComplete(a)) onSubmit(a);
      }}
    >
      <h1>About the method you just used</h1>
      <p>
        You used: <strong>{MODE_LABEL[mode]}</strong>. For each sentence, choose the answer that
        fits you best. There are no right or wrong answers.
      </p>
      {ITEMS.map((i) => (
        <fieldset key={i.id} className={styles.q}>
          <legend>{i.text}</legend>
          <div className={styles.scale} role="radiogroup">
            {LIKERT.map((l) => (
              <label key={l.value}>
                <input
                  type="radio"
                  name={i.id}
                  value={l.value}
                  checked={a[i.id] === l.value}
                  onChange={() => setA({ ...a, [i.id]: l.value })}
                />
                <span>{l.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="submit" disabled={left > 0}>
        {left > 0 ? `${left} question${left === 1 ? '' : 's'} left` : 'Send answers'}
      </button>
    </form>
  );
}

/** After both methods: which one, with "No difference" in the middle. */
export function ComparisonForm({
  participant,
  onSubmit,
}: {
  participant: number;
  onSubmit: (a: Record<string, Preference>) => void;
}) {
  const [a, setA] = useState<Record<string, Preference>>({});
  const options = comparisonOptions(participant);
  const done = COMPARISON.every((q) => a[q.id]);
  return (
    <form
      className={styles.page}
      onSubmit={(e) => {
        e.preventDefault();
        if (done) onSubmit(a);
      }}
    >
      <h1>Now that you have tried both</h1>
      {COMPARISON.map((q) => (
        <fieldset key={q.id} className={styles.q}>
          <legend>{q.text}</legend>
          <div className={styles.scale} role="radiogroup">
            {options.map((o) => (
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
      <button type="submit" disabled={!done}>
        Send answers
      </button>
    </form>
  );
}
