import { useRef, useState } from 'react';
import { offlineSentence } from '../nlp/sentence';
import type { Place } from '../nlp/words';
import { isSuccess, type Task } from './design';
import { Overlay } from '../ui/Overlay';
import styles from './Study.module.css';

export interface KeyboardResult {
  corrections: number;
  rejections: number;
  attempts: number;
  finalText: string;
  success: boolean;
}

const PLACES: Place[] = ['Clinic', 'Shop', 'Work', 'Home'];

/**
 * The comparison technique: the same task with keyboard and mouse. The steps match the camera flow:
 * choose where you are, enter the words, look at the suggested sentence, accept it or ask for another.
 * It uses the same sentence builder as the camera app, so the two methods differ only in the input.
 */
export function KeyboardTask({
  task,
  onDone,
}: {
  task: Task;
  onDone: (r: KeyboardResult) => void;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [text, setText] = useState('');
  const [attempt, setAttempt] = useState<number | null>(null);
  const corrections = useRef(0);
  const rejections = useRef(0);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentence =
    attempt === null
      ? ''
      : offlineSentence(
          words.map((w) => w.toUpperCase()),
          place ?? 'Clinic',
          attempt,
        );

  return (
    <Overlay>
      <main className={styles.page} data-testid="keyboard-task">
        <h1>Write a message</h1>
        <p className={styles.prompt}>
          Task: you are at the <strong>{task.place}</strong>. Your message has two words:{' '}
          <strong>{task.words.join(' and ').toLowerCase()}</strong>.
        </p>

        <fieldset className={styles.q}>
          <legend>1. Where are you?</legend>
          <div className={styles.scale}>
            {PLACES.map((p) => (
              <label key={p}>
                <input
                  type="radio"
                  name="place"
                  checked={place === p}
                  onChange={() => setPlace(p)}
                />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={styles.q}>
          <span>2. Type the words of your message</span>
          <input
            type="text"
            value={text}
            autoComplete="off"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' || e.key === 'Delete') corrections.current++;
            }}
          />
        </label>

        {attempt === null ? (
          <button
            type="button"
            disabled={!place || words.length === 0}
            onClick={() => setAttempt(0)}
          >
            Show sentence
          </button>
        ) : (
          <section className={styles.q} aria-live="polite">
            <p className={styles.sentence}>{sentence}</p>
            <button
              type="button"
              onClick={() =>
                onDone({
                  corrections: corrections.current,
                  rejections: rejections.current,
                  attempts: rejections.current + 1,
                  finalText: sentence,
                  success: isSuccess(task, sentence) && place === task.place,
                })
              }
            >
              Use this sentence
            </button>{' '}
            <button
              type="button"
              onClick={() => {
                rejections.current++;
                setAttempt(attempt + 1);
              }}
            >
              Try another
            </button>{' '}
            <button type="button" onClick={() => setAttempt(null)}>
              Change the words
            </button>
          </section>
        )}
      </main>
    </Overlay>
  );
}
