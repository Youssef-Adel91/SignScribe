import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REJECT_LABEL } from '../config/alphabet';
import { CameraView } from '../ui/CameraView';
import { download } from '../study/download';
import { useVision, visionStore } from '../vision/store';
import {
  LETTERS,
  coverage,
  defaultKind,
  fromJsonl,
  gaps,
  toJsonl,
  type NoneTag,
  type SigningHand,
  type Take,
  type TakeKind,
} from './dataset';
import { TakeRecorder, type RecorderState } from './recorder';
import { GUIDED, GuidedRun, type GuidedStep } from './guided';
import { IdbStore, MemoryStore, type TakeStore } from './store';
import { Overlay } from '../ui/Overlay';
import styles from './Collect.module.css';

const NONE_CHOICES: { tag: NoneTag; text: string }[] = [
  { tag: 'moving', text: 'hand moving' },
  { tag: 'relaxed', text: 'relaxed hand' },
  { tag: 'command-zone', text: 'hand in the command zone' },
  { tag: 'other', text: 'anything else' },
];
const noneCount = (takes: readonly Take[], tag: NoneTag) =>
  takes.filter((t) => t.label === REJECT_LABEL && (t.tag ?? 'other') === tag).length;

const LS = 'signscribe.collect.sitting';
function loadSitting() {
  try {
    const p = JSON.parse(localStorage.getItem(LS) ?? '{}') as {
      signer?: string;
      session?: string;
      hand?: SigningHand;
    };
    return {
      signer: p.signer ?? '',
      session: p.session ?? '',
      hand: p.hand === 'left' ? ('left' as const) : ('right' as const),
    };
  } catch {
    return { signer: '', session: '', hand: 'right' as const };
  }
}

/**
 * Data collection mode (`/?collect=1`): record labelled takes of hand landmarks (no pictures are
 * stored), see how much exists per letter, export JSONL for ml/. A researcher's tool, so it uses
 * mouse and keyboard; the signing screens stay gesture-only.
 */
export function CollectPanel() {
  const store = useMemo<TakeStore>(() => {
    try {
      return typeof indexedDB === 'undefined' ? new MemoryStore() : new IdbStore();
    } catch {
      return new MemoryStore();
    }
  }, []);
  const [takes, setTakes] = useState<Take[]>([]);
  const [sitting, setSitting] = useState(loadSitting);
  const [label, setLabel] = useState('A');
  const [kind, setKind] = useState<TakeKind>('static');
  const [state, setState] = useState<RecorderState>({ kind: 'idle' });
  const [message, setMessage] = useState('');
  const rec = useRef(new TakeRecorder());
  const [target, setTarget] = useState(5);
  const guided = useRef<GuidedRun | null>(null);
  const [step, setStep] = useState<GuidedStep | null>(null);
  const [guidedNote, setGuidedNote] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takesRef = useRef<Take[]>([]);
  takesRef.current = takes;
  const sittingRef = useRef(sitting);
  sittingRef.current = sitting;
  const status = useVision((s) => s.status);
  const hands = useVision((s) => s.ui?.hands ?? 0);

  const refresh = useCallback(() => void store.all().then(setTakes), [store]);
  useEffect(refresh, [refresh]);
  useEffect(() => {
    try {
      localStorage.setItem(LS, JSON.stringify(sitting));
    } catch {
      /* ignore */
    }
  }, [sitting]);
  useEffect(() => setKind(defaultKind(label)), [label]);

  const startStep = useCallback(() => {
    const g = guided.current;
    if (!g) return;
    const st = g.current();
    if (!st) {
      guided.current = null;
      setStep(null);
      setGuidedNote(`Finished: every letter has at least ${g.target} takes.`);
      return;
    }
    setStep(st);
    setLabel(st.label);
    setKind(st.kind);
    setMessage('');
    rec.current.start(
      st.label,
      sittingRef.current,
      visionStore.state.frame?.t ?? performance.now(),
      st.kind,
      st.countdownMs,
    );
    setState(rec.current.state);
  }, []);

  const stopGuided = useCallback((note: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    guided.current = null;
    rec.current.cancel();
    setState({ kind: 'idle' });
    setStep(null);
    setGuidedNote(note);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // every camera frame goes to the recorder while a take is running
  useEffect(() => {
    let lastFrame: unknown = null;
    return visionStore.subscribe(() => {
      const f = visionStore.state.frame;
      if (!f || f === lastFrame || rec.current.state.kind === 'idle') return;
      lastFrame = f;
      const s = rec.current.feed(f);
      setState((prev) =>
        prev.kind === s.kind && s.kind !== 'countdown' && s.kind !== 'recording' ? prev : s,
      );
      if (s.kind === 'done') {
        const take = s.take;
        rec.current.cancel();
        void store.add(take).then(refresh);
        setMessage(`Saved: ${take.label}, ${take.frames.length} frames.`);
        if (guided.current) {
          guided.current.saved();
          timer.current = setTimeout(startStep, GUIDED.restMs);
        }
      } else if (s.kind === 'failed') {
        rec.current.cancel();
        setMessage(s.reason);
        if (guided.current) {
          if (guided.current.failed() === 'stop')
            stopGuided(
              `Stopped: ${GUIDED.maxFailsInRow} takes in a row were refused (${s.reason}).`,
            );
          else timer.current = setTimeout(startStep, GUIDED.failRestMs);
        }
      }
    });
  }, [store, refresh, startStep, stopGuided]);

  const ready =
    sitting.signer.trim() !== '' && sitting.session.trim() !== '' && status === 'running';
  const running = step !== null;
  const busy = running || state.kind === 'countdown' || state.kind === 'recording';
  const cov = coverage(takes);
  const missing = gaps(takes, target);
  const perLetter = (l: string) => cov.find((c) => c.label === l)?.takes ?? 0;
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <Overlay>
      <main className={styles.page} data-testid="collect-panel">
        <h1>Data collection</h1>
        <p>
          Records hand landmarks only (no pictures). Use an anonymous signer code. One{' '}
          <em>session</em> = same light, distance and camera. Takes from the same signer and session
          are never split between training and testing.
        </p>
        <div className={styles.grid}>
          <section>
            <CameraView label="Camera preview" className={styles.cam} />
            {step && (
              <p className={styles.prompt} data-testid="guided-prompt">
                <span className={styles.promptLetter}>{step.label}</span> take {step.takeNo} of{' '}
                {step.ofTotal}
                {step.newLetter ? ' (new letter: change your sign)' : ''}
                <small>
                  {guided.current?.done ?? 0} of {guided.current?.total ?? 0} takes done
                </small>
              </p>
            )}
            {!step && guidedNote && (
              <p className={styles.hint} role="status" data-testid="guided-note">
                {guidedNote}
              </p>
            )}
            <p role="status" className={styles.status} data-testid="collect-status">
              {status !== 'running'
                ? `Camera: ${status}`
                : state.kind === 'countdown'
                  ? `Get ready: ${state.secondsLeft}`
                  : state.kind === 'recording'
                    ? `Recording ${state.label}… ${Math.round(state.progress * 100)}%`
                    : message ||
                      (hands === 0
                        ? 'No hand in view'
                        : `${hands} hand${hands > 1 ? 's' : ''} in view`)}
            </p>
          </section>
          <section>
            <fieldset className={styles.f}>
              <legend>Sitting</legend>
              <label>
                Signer code{' '}
                <input
                  value={sitting.signer}
                  placeholder="s01"
                  onChange={(e) => setSitting({ ...sitting, signer: e.target.value.trim() })}
                />
              </label>
              <label>
                Session note{' '}
                <input
                  value={sitting.session}
                  placeholder="lamp-60cm"
                  onChange={(e) => setSitting({ ...sitting, session: e.target.value.trim() })}
                />
              </label>
              <label>
                Signing hand{' '}
                <select
                  value={sitting.hand}
                  onChange={(e) => setSitting({ ...sitting, hand: e.target.value as SigningHand })}
                >
                  <option value="right">right</option>
                  <option value="left">left</option>
                </select>
              </label>
            </fieldset>
            <fieldset className={styles.f}>
              <legend>Letter</legend>
              <div className={styles.letters} role="radiogroup" aria-label="Letter to record">
                {LETTERS.map((l) => (
                  <label
                    key={l}
                    className={`${label === l ? styles.on : ''} ${
                      perLetter(l) === 0
                        ? styles.none
                        : perLetter(l) < target
                          ? styles.part
                          : styles.full
                    }`}
                  >
                    <input
                      type="radio"
                      name="letter"
                      disabled={running}
                      aria-label={`Letter ${l}, ${perLetter(l)} of ${target} takes`}
                      checked={label === l}
                      onChange={() => setLabel(l)}
                    />
                    <span>{l}</span>
                    <small>
                      {perLetter(l)}/{target}
                    </small>
                  </label>
                ))}
              </div>
              <p data-testid="gaps" className={styles.gaps}>
                {missing.length === 0
                  ? `Every letter has at least ${target} takes.`
                  : `Still needed (target ${target} per letter): ${missing
                      .map((g) => `${g.label} ${g.missing}`)
                      .join(', ')}`}
              </p>
              <label>
                Kind{' '}
                <select value={kind} onChange={(e) => setKind(e.target.value as TakeKind)}>
                  <option value="static">static (hold still)</option>
                  <option value="dynamic">moving (draw it in the air)</option>
                </select>
              </label>
            </fieldset>
            <fieldset className={styles.f}>
              <legend>Guided run</legend>
              <label>
                Takes per letter{' '}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={target}
                  disabled={running}
                  onChange={(e) =>
                    setTarget(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                  }
                />
              </label>
              <p>
                <button
                  type="button"
                  disabled={!ready || busy || missing.length === 0}
                  onClick={() => {
                    setGuidedNote('');
                    guided.current = new GuidedRun(LETTERS, countsOf(takesRef.current), target);
                    startStep();
                  }}
                >
                  Start guided run
                </button>{' '}
                <button
                  type="button"
                  disabled={!running}
                  onClick={() => stopGuided('Stopped. Takes already saved are kept.')}
                >
                  Stop
                </button>{' '}
                <button
                  type="button"
                  disabled={!running}
                  onClick={() => {
                    guided.current?.skipLetter();
                    rec.current.cancel();
                    if (timer.current) clearTimeout(timer.current);
                    startStep();
                  }}
                >
                  Skip letter
                </button>
              </p>
              <p className={styles.hint}>
                Fills the gaps: each letter below the target is recorded one take after another
                (letter shown, 3 s countdown for the first take, 1.5 s for the rest, saved
                automatically). Refused takes are retried; 3 in a row stop the run.
              </p>
            </fieldset>
            <fieldset className={styles.f} data-testid="none-takes">
              <legend>No letter (&quot;none&quot;)</legend>
              <p className={styles.hint}>
                Takes of everything that is NOT a letter, so the model can answer &quot;none&quot;:
                the hand moving, a relaxed hand, a hand in the command zone. Record several of each,
                with different people and sittings. They are labelled <code>none</code> and kept in
                the same file; keep the file out of git.
              </p>
              {NONE_CHOICES.map((c) => (
                <button
                  key={c.tag}
                  type="button"
                  disabled={!ready || busy}
                  onClick={() => {
                    setMessage('');
                    rec.current.start(
                      REJECT_LABEL,
                      sitting,
                      visionStore.state.frame?.t ?? performance.now(),
                      'static',
                      undefined,
                      c.tag,
                    );
                    setLabel(REJECT_LABEL);
                    setState(rec.current.state);
                  }}
                >
                  None take: {c.text} ({noneCount(takes, c.tag)})
                </button>
              ))}
            </fieldset>
            <p>
              <button
                type="button"
                disabled={!ready || busy}
                onClick={() => {
                  setMessage('');
                  // frame times and the countdown must share one clock (the camera's)
                  rec.current.start(
                    label,
                    sitting,
                    visionStore.state.frame?.t ?? performance.now(),
                    kind,
                  );
                  setState(rec.current.state);
                }}
              >
                Record {label}
              </button>{' '}
              <button
                type="button"
                disabled={!busy}
                onClick={() => {
                  if (running) return stopGuided('Stopped. Takes already saved are kept.');
                  rec.current.cancel();
                  setState({ kind: 'idle' });
                }}
              >
                Cancel
              </button>{' '}
              <button
                type="button"
                disabled={takes.length === 0 || busy}
                onClick={() => {
                  const last = takes[takes.length - 1];
                  void store.remove(last.id).then(refresh);
                  setMessage(`Removed the last take (${last.label}).`);
                }}
              >
                Undo last take
              </button>
            </p>
            {!ready && (
              <p className={styles.hint}>
                Fill in signer code and session note, and wait for the camera, to record.
              </p>
            )}
            <p>
              Takes saved in this browser: <strong>{takes.length}</strong> (
              {new Set(takes.map((t) => t.signer)).size} signers).
            </p>
            <p>
              <button
                type="button"
                disabled={takes.length === 0}
                onClick={() =>
                  download(
                    `signscribe-takes-${stamp}.jsonl`,
                    toJsonl(takes),
                    'application/x-ndjson',
                  )
                }
              >
                Export JSONL
              </button>{' '}
              <label className={styles.import}>
                Import JSONL{' '}
                <input
                  type="file"
                  accept=".jsonl,.json,.txt"
                  onChange={(e) => void importFile(e.target.files?.[0], store, refresh, setMessage)}
                />
              </label>{' '}
              <button
                type="button"
                disabled={takes.length === 0}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete all ${takes.length} takes from this browser? Export first.`,
                    )
                  )
                    void store.clear().then(refresh);
                }}
              >
                Delete all
              </button>
            </p>
          </section>
        </div>
      </main>
    </Overlay>
  );
}

function countsOf(takes: readonly Take[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of takes) out[t.label] = (out[t.label] ?? 0) + 1;
  return out;
}

async function importFile(
  file: File | undefined,
  store: TakeStore,
  refresh: () => void,
  say: (m: string) => void,
) {
  if (!file) return;
  try {
    const incoming = fromJsonl(await file.text());
    const have = new Set((await store.all()).map((t) => t.id));
    let added = 0;
    for (const t of incoming) {
      if (!have.has(t.id)) {
        await store.add(t);
        added++;
      }
    }
    say(`Imported ${added} take(s); ${incoming.length - added} already existed.`);
    refresh();
  } catch (e) {
    say(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
