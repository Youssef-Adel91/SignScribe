import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CameraView } from '../ui/CameraView';
import { download } from '../study/download';
import { useVision, visionStore } from '../vision/store';
import {
  LETTERS,
  coverage,
  defaultKind,
  fromJsonl,
  toJsonl,
  type SigningHand,
  type Take,
  type TakeKind,
} from './dataset';
import { TakeRecorder, type RecorderState } from './recorder';
import { IdbStore, MemoryStore, type TakeStore } from './store';
import { Overlay } from '../ui/Overlay';
import styles from './Collect.module.css';

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
      } else if (s.kind === 'failed') {
        rec.current.cancel();
        setMessage(s.reason);
      }
    });
  }, [store, refresh]);

  const ready =
    sitting.signer.trim() !== '' && sitting.session.trim() !== '' && status === 'running';
  const busy = state.kind === 'countdown' || state.kind === 'recording';
  const cov = coverage(takes);
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
                  <label key={l} className={label === l ? styles.on : ''}>
                    <input
                      type="radio"
                      name="letter"
                      aria-label={`Letter ${l}, ${cov.find((c) => c.label === l)?.takes ?? 0} takes`}
                      checked={label === l}
                      onChange={() => setLabel(l)}
                    />
                    <span>{l}</span>
                    <small>{cov.find((c) => c.label === l)?.takes ?? 0}</small>
                  </label>
                ))}
              </div>
              <label>
                Kind{' '}
                <select value={kind} onChange={(e) => setKind(e.target.value as TakeKind)}>
                  <option value="static">static (hold still)</option>
                  <option value="dynamic">moving (draw it in the air)</option>
                </select>
              </label>
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
