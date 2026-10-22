import { useEffect, useRef, useState } from 'react';
import { download } from '../study/download';
import { Outside } from '../ui/Overlay';
import { useVision, visionStore } from '../vision/store';
import { provenance, summarize, type PerfReport, type PerfSummary, type Sample } from './summary';
import styles from '../study/Study.module.css';

const SECONDS = 30;
const fmt = (v: number | undefined, d = 1) =>
  v === undefined || !Number.isFinite(v) ? 'n/a' : v.toFixed(d);

/**
 * Performance recording (`/?perf=1`). Press Record, use the app normally for 30 s (hold a hand in view,
 * make gestures), read the summary and export the JSON. It measures; it never estimates.
 */
export function PerfPanel() {
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(SECONDS);
  const [report, setReport] = useState<PerfReport | null>(null);
  const status = useVision((s) => s.status);
  const samples = useRef<Sample[]>([]);
  const longTasks = useRef<number[]>([]);
  const handFrames = useRef(0);

  useEffect(() => {
    if (!running) return;
    samples.current = [];
    longTasks.current = [];
    handFrames.current = 0;
    let last: unknown = null;
    const un = visionStore.subscribe(() => {
      const st = visionStore.state;
      if (!st.frame || st.frame === last) return;
      last = st.frame;
      samples.current.push({ t: st.frame.t, inferMs: st.inferMs, stepMs: st.stepMs });
      if (st.frame.hands.length > 0) handFrames.current++;
    });
    let obs: PerformanceObserver | null = null;
    try {
      obs = new PerformanceObserver((list) =>
        list.getEntries().forEach((e) => longTasks.current.push(e.duration)),
      );
      obs.observe({ entryTypes: ['longtask'] });
    } catch {
      obs = null; // not available in every browser
    }
    const started = performance.now();
    const tick = window.setInterval(() => {
      const remaining = SECONDS - (performance.now() - started) / 1000;
      setLeft(Math.max(0, Math.ceil(remaining)));
      if (remaining <= 0) {
        clearInterval(tick);
        un();
        obs?.disconnect();
        const st = visionStore.state;
        const nav = navigator as Navigator & { deviceMemory?: number };
        const summary = summarize(
          samples.current,
          longTasks.current,
          st.source === 'mock' ? 'mock' : 'camera',
          handFrames.current,
        );
        setReport({
          version: 1,
          recordedAt: new Date().toISOString(),
          environment: {
            userAgent: navigator.userAgent,
            cores: navigator.hardwareConcurrency ?? null,
            memoryGb: nav.deviceMemory ?? null,
            devicePixelRatio: window.devicePixelRatio,
            screen: `${window.screen.width}x${window.screen.height}`,
            video: st.video.w ? `${st.video.w}x${st.video.h}` : 'n/a',
            delegate: st.delegate,
          },
          summary,
        });
        setRunning(false);
      }
    }, 250);
    return () => {
      clearInterval(tick);
      un();
      obs?.disconnect();
    };
  }, [running]);

  const s: PerfSummary | undefined = report?.summary;
  return (
    <Outside>
      <aside
        className={styles.panel}
        style={{ left: 'auto', right: 8, width: 380 }}
        aria-label="Performance recording"
        data-testid="perf-panel"
      >
        <h2>Performance recording</h2>
        <p>
          Camera status: <strong>{status}</strong>. Use the app for {SECONDS} s with a hand in view
          while recording.
        </p>
        <button
          type="button"
          disabled={running || status !== 'running'}
          onClick={() => {
            setReport(null);
            setLeft(SECONDS);
            setRunning(true);
          }}
        >
          {running ? `Recording… ${left} s` : 'Record 30 s'}
        </button>
        {s && report && (
          <>
            <p data-testid="perf-provenance">{provenance(s)}</p>
            <table>
              <tbody>
                <tr>
                  <th>frames</th>
                  <td>
                    {s.frames} in {fmt(s.durationMs / 1000)} s
                  </td>
                </tr>
                <tr>
                  <th>fps mean / worst second</th>
                  <td>
                    {fmt(s.fpsMean)} / {fmt(s.fpsWorstSecond, 0)}
                  </td>
                </tr>
                <tr>
                  <th>frame gap p50 / p95 / max</th>
                  <td>
                    {fmt(s.frameIntervalMs?.p50)} / {fmt(s.frameIntervalMs?.p95)} /{' '}
                    {fmt(s.frameIntervalMs?.max)} ms
                  </td>
                </tr>
                <tr>
                  <th>model p50 / p95 / max</th>
                  <td>
                    {fmt(s.inferMs?.p50)} / {fmt(s.inferMs?.p95)} / {fmt(s.inferMs?.max)} ms
                  </td>
                </tr>
                <tr>
                  <th>our code p50 / p95 / max</th>
                  <td>
                    {fmt(s.stepMs?.p50, 2)} / {fmt(s.stepMs?.p95, 2)} / {fmt(s.stepMs?.max, 2)} ms
                  </td>
                </tr>
                <tr>
                  <th>stalls (gap &gt; 200 ms)</th>
                  <td>{s.stalls}</td>
                </tr>
                <tr>
                  <th>long tasks</th>
                  <td>
                    {s.longTasks.count} ({fmt(s.longTasks.totalMs, 0)} ms)
                  </td>
                </tr>
                <tr>
                  <th>hand seen</th>
                  <td>
                    {s.handShare === null ? 'n/a' : `${Math.round(s.handShare * 100)}% of frames`}
                  </td>
                </tr>
                <tr>
                  <th>delegate</th>
                  <td>{report.environment.delegate ?? 'n/a'}</td>
                </tr>
              </tbody>
            </table>
            <button
              type="button"
              onClick={() =>
                download(
                  `signscribe-perf-${report.recordedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`,
                  JSON.stringify(report, null, 2),
                  'application/json',
                )
              }
            >
              Export JSON
            </button>
          </>
        )}
      </aside>
    </Outside>
  );
}
