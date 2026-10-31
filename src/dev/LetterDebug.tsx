import { useEffect, useState } from 'react';
import { letterLog } from '../recognition/letterLog';
import {
  RANGES,
  TUNING_KEYS,
  clearSavedTuning,
  modelTypeOf,
  notifyTuningSaved,
  saveTuning,
  type LetterTuning,
} from '../recognition/tuning';
import { download } from '../study/download';
import { useVision } from '../vision/store';
import styles from './LetterDebug.module.css';

/** who decided the frame, in words */
const SOURCE_NAME = {
  'rule-gesture': 'old rule gesture',
  'control-class': 'control class (letter model)',
  '$1-template': '$1 template',
  'letter-model': 'letter model',
  none: '-',
} as const;

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

/**
 * Letter debug overlay (`?letterdebug=1`): why a letter fires or does not. Top 3 letters with confidence, hand speed against its
 * limit, the still-frame counter, the state, what is blocking, the values in force (editable and saved per alphabet and model type)
 * and the log of every spelling frame as a CSV download. A researcher tool: the signer never sees it.
 */
export function LetterDebug() {
  const ui = useVision((s) => s.letters.ui);
  const tuning = useVision((s) => s.letters.tuning);
  const alphabetId = useVision((s) => s.letters.alphabetId);
  const modelId = useVision((s) => s.letters.modelId);
  const status = useVision((s) => s.letters.status);
  const hands = useVision((s) => s.ui);
  const [draft, setDraft] = useState<Partial<Record<keyof LetterTuning, string>>>({});
  const [rows, setRows] = useState(0);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const id = window.setInterval(() => setRows(letterLog.rows.length), 500);
    return () => clearInterval(id);
  }, []);
  const d = ui?.debug;
  const key = `${alphabetId}/${modelTypeOf(modelId)}`;

  const save = () => {
    const out: Partial<LetterTuning> = {};
    for (const k of TUNING_KEYS) {
      const v = draft[k];
      if (v !== undefined && v.trim() !== '') out[k] = Number(v);
    }
    saveTuning(alphabetId, modelId, { ...(tuning ?? {}), ...out });
    notifyTuningSaved();
    setDraft({});
    setMsg(`saved for ${key} (values outside their range are ignored)`);
  };
  const reset = () => {
    clearSavedTuning(alphabetId, modelId);
    notifyTuningSaved();
    setDraft({});
    setMsg(`${key}: back to the defaults`);
  };
  const downloadLog = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    download(`signscribe-letterdebug-${stamp}.csv`, letterLog.toCsv());
  };

  return (
    <aside className={styles.panel} aria-label="Letter debug" data-testid="letter-debug">
      <header>
        <strong>Letter debug</strong>
        <span>
          {key} · {status}
        </span>
      </header>
      <table>
        <tbody>
          <tr>
            <th scope="row">state</th>
            <td data-testid="letter-state">
              {d?.state ?? '-'}
              {d?.rejectedBecause ? ` (${d.rejectedBecause})` : ''}
            </td>
          </tr>
          <tr>
            <th scope="row">decided by</th>
            <td data-testid="letter-source">
              {d && d.source !== 'none'
                ? `${SOURCE_NAME[d.source]}: ${d.decided || '-'} (score ${d.score.toFixed(2)})`
                : '-'}
            </td>
          </tr>
          <tr>
            <th scope="row">top 3</th>
            <td data-testid="letter-top3">
              {ui && ui.raw.length
                ? ui.raw.map((r) => `${r.letter} ${pct(r.confidence)}`).join('   ')
                : '-'}
            </td>
          </tr>
          <tr>
            <th scope="row">hand speed</th>
            <td>
              {d ? d.speed.toFixed(2) : '-'} / limit {tuning ? tuning.maxSpeed : '-'} (palm/s)
            </td>
          </tr>
          <tr>
            <th scope="row">still frames</th>
            <td>{d ? `${d.stillCount} / ${d.stillFrames}` : '-'}</td>
          </tr>
          <tr>
            <th scope="row">same letter for</th>
            <td>
              {d ? Math.round(d.stableMs) : 0} ms (shown at {tuning?.stableMs ?? '-'}, written at{' '}
              {tuning?.holdMs ?? '-'})
            </td>
          </tr>
          <tr>
            <th scope="row">hold</th>
            <td>{ui ? pct(ui.progress) : '-'}</td>
          </tr>
          <tr>
            <th scope="row">cooldown / command</th>
            <td>
              {d ? `${Math.round(d.cooldownLeftMs)} ms / ${Math.round(d.commandLeftMs)} ms` : '-'}
            </td>
          </tr>
          <tr>
            <th scope="row">control gesture</th>
            <td>
              {hands?.command.label ? `${hands.command.label} ${pct(hands.command.progress)}` : '-'}
            </td>
          </tr>
          <tr>
            <th scope="row">shown to signer</th>
            <td>{ui?.guess ? `${ui.guess.letter} ${pct(ui.guess.confidence)}` : 'nothing'}</td>
          </tr>
        </tbody>
      </table>

      <details>
        <summary>Settings for {key}</summary>
        <p className={styles.note}>
          First guesses, not measured. Edit, then Save: applies from the next frame and is kept in
          this browser for this alphabet and model type.
        </p>
        <table>
          <tbody>
            {TUNING_KEYS.map((k) => (
              <tr key={k}>
                <th scope="row">
                  <label htmlFor={`tune-${k}`}>{k}</label>
                </th>
                <td>
                  <input
                    id={`tune-${k}`}
                    type="number"
                    step="any"
                    min={RANGES[k][0]}
                    max={RANGES[k][1]}
                    placeholder={tuning ? String(tuning[k]) : ''}
                    value={draft[k] ?? ''}
                    onChange={(e) => setDraft((v) => ({ ...v, [k]: e.target.value }))}
                  />{' '}
                  <small>
                    {tuning ? tuning[k] : '-'} ({RANGES[k][0]}–{RANGES[k][1]})
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={save}>
          Save
        </button>{' '}
        <button type="button" onClick={reset}>
          Defaults
        </button>
        {msg && <p className={styles.note}>{msg}</p>}
      </details>

      <footer>
        <button type="button" onClick={downloadLog} disabled={rows === 0}>
          Download log (CSV, {rows} frames)
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            letterLog.clear();
            setRows(0);
          }}
        >
          Clear
        </button>
        <p className={styles.note}>
          The log has numbers and letter names only. It is git-ignored; keep it out of the
          repository.
        </p>
      </footer>
    </aside>
  );
}
