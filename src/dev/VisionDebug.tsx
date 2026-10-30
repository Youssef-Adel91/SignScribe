import { useState } from 'react';
import { LETTER } from '../recognition/letterController';
import { useVision } from '../vision/store';
import styles from './VisionDebug.module.css';

/** Developer panel (only with ?dev=1): what the camera pipeline sees right now. */
export function VisionDebug() {
  const [open, setOpen] = useState(true);
  const status = useVision((s) => s.status);
  const message = useVision((s) => s.message);
  const source = useVision((s) => s.source);
  const fps = useVision((s) => s.fps);
  const inferMs = useVision((s) => s.inferMs);
  const luma = useVision((s) => s.luma);
  const video = useVision((s) => s.video);
  const ui = useVision((s) => s.ui);
  const checks = useVision((s) => s.checks);
  const letterUi = useVision((s) => s.letters.ui);
  if (!open) {
    return (
      <button type="button" className={styles.reopen} onClick={() => setOpen(true)}>
        Vision
      </button>
    );
  }
  const row = (k: string, v: string) => (
    <tr key={k}>
      <th scope="row">{k}</th>
      <td>{v}</td>
    </tr>
  );
  return (
    <aside className={styles.panel} aria-label="Vision debug" data-testid="vision-debug">
      <header>
        <strong>Vision debug</strong>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide vision debug">
          ×
        </button>
      </header>
      <table>
        <tbody>
          {row('status', `${status} (${source})${message ? ': ' + message : ''}`)}
          {row('camera fps', fps ? fps.toFixed(1) : '-')}
          {row('inference ms', inferMs ? inferMs.toFixed(1) : '-')}
          {row('video', video.w ? `${video.w}x${video.h}` : '-')}
          {row('light (0-255)', luma === null ? '-' : luma.toFixed(0))}
          {row('hands', String(ui?.hands ?? 0))}
          {(ui?.handViews ?? []).map((h, i) =>
            row(
              `hand ${i + 1}`,
              `${h.side}${h.inZone ? ' (zone)' : ''}: ${h.gesture} ${(h.confidence * 100).toFixed(0)}%`,
            ),
          )}
          {row(
            'pointer',
            ui?.pointer ? `${ui.pointer.x.toFixed(0)}, ${ui.pointer.y.toFixed(0)}` : '-',
          )}
          {row(
            'dwell',
            ui?.dwell.id ? `${ui.dwell.id} ${(ui.dwell.progress * 100).toFixed(0)}%` : '-',
          )}
          {row('dwell time ms', ui ? String(ui.dwell.ms) : '-')}
          {row(
            'wake / help',
            ui ? `${(ui.wake * 100).toFixed(0)}% / ${(ui.help * 100).toFixed(0)}%` : '-',
          )}
          {row(
            'command',
            ui?.command.label
              ? `${ui.command.label} ${(ui.command.progress * 100).toFixed(0)}%`
              : '-',
          )}
          {row('hand lost', ui?.handLost ? 'yes' : 'no')}
          {row(
            'letter top 2',
            letterUi && letterUi.raw.length
              ? letterUi.raw
                  .map((r) => `${r.letter} ${(r.confidence * 100).toFixed(0)}%`)
                  .join('  ') +
                  (letterUi.guess
                    ? ''
                    : `  (hidden: below ${(LETTER.minConfidence * 100).toFixed(0)}%)`)
              : '-',
          )}
          {row(
            'checks',
            checks
              ? `light ${checks.light.state}, distance ${checks.distance.state}, hand ${checks.hand.state}`
              : '-',
          )}
        </tbody>
      </table>
    </aside>
  );
}
