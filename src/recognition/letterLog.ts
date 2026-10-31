import type { LetterUI } from './letterController';

/**
 * The letter debug log (`?letterdebug=1`): one row per camera frame on the spelling screens, kept in memory and downloaded as a CSV
 * by the person who is testing. It holds numbers and letter names only: no pictures, no landmarks, no names. The downloaded file is
 * git-ignored (`signscribe-letterdebug-*.csv`).
 */
export interface LogRow {
  t: number;
  screen: number;
  state: string;
  source: string;
  decided: string;
  score: number;
  speed: number;
  stillCount: number;
  stillFrames: number;
  stableMs: number;
  top: { letter: string; confidence: number }[];
  shown: string;
  progress: number;
  rejectedBecause: string;
  commandActive: boolean;
  commandFired: boolean;
  commandLabel: string;
  events: string;
  tuning: string;
}

export const LOG_HEAD = [
  't_ms',
  'screen',
  'state',
  'decided_by',
  'decided',
  'score',
  'speed_palm_per_s',
  'still_count',
  'still_frames_needed',
  'stable_ms',
  'top1',
  'conf1',
  'top2',
  'conf2',
  'top3',
  'conf3',
  'shown_guess',
  'progress',
  'rejected_because',
  'command_active',
  'command_fired',
  'command_gesture',
  'events',
  'alphabet_model',
] as const;

const esc = (v: string | number | boolean): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export class LetterLog {
  rows: LogRow[] = [];
  constructor(private readonly max = 30_000) {}

  record(r: LogRow): void {
    this.rows.push(r);
    if (this.rows.length > this.max) this.rows.splice(0, this.rows.length - this.max);
  }
  clear(): void {
    this.rows = [];
  }
  toCsv(): string {
    const lines = this.rows.map((r) => {
      const [a, b, c] = [r.top[0], r.top[1], r.top[2]];
      const cell = (x?: { letter: string; confidence: number }) => [
        x?.letter ?? '',
        x ? x.confidence.toFixed(3) : '',
      ];
      return [
        Math.round(r.t),
        r.screen,
        r.state,
        r.source,
        r.decided,
        r.score.toFixed(3),
        r.speed.toFixed(3),
        r.stillCount,
        r.stillFrames,
        Math.round(r.stableMs),
        ...cell(a),
        ...cell(b),
        ...cell(c),
        r.shown,
        r.progress.toFixed(2),
        r.rejectedBecause,
        r.commandActive,
        r.commandFired,
        r.commandLabel,
        r.events,
        r.tuning,
      ]
        .map(esc)
        .join(',');
    });
    return [LOG_HEAD.join(','), ...lines].join('\n') + '\n';
  }
}

export const letterLog = new LetterLog();

export function rowOf(
  t: number,
  screen: number,
  ui: LetterUI,
  command: { active: boolean; fired: boolean; label: string },
  events: string[],
  tuning: string,
): LogRow {
  return {
    t,
    screen,
    state: ui.debug.state,
    source: ui.debug.source,
    decided: ui.debug.decided,
    score: ui.debug.score,
    speed: ui.debug.speed,
    stillCount: ui.debug.stillCount,
    stillFrames: ui.debug.stillFrames,
    stableMs: ui.debug.stableMs,
    top: ui.raw,
    shown: ui.guess?.letter ?? '',
    progress: ui.progress,
    rejectedBecause: ui.debug.rejectedBecause,
    commandActive: command.active,
    commandFired: command.fired,
    commandLabel: command.label,
    events: events.join(' '),
    tuning,
  };
}
