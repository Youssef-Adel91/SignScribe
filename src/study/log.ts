import type { Mode, TaskSetId } from './design';
import { ITEMS, type Answers, type Preference } from './survey';

export interface TrialLog {
  participant: number;
  block: 0 | 1;
  mode: Mode;
  set: TaskSetId;
  taskId: string;
  startedAt: number; // ms since epoch
  durationMs: number;
  /** delete / backspace: the person took something back */
  corrections: number;
  /** "try another" on the sentence: the first sentence was not accepted */
  rejections: number;
  /** thumbs-down / back steps (camera) */
  backs: number;
  /** camera only: the hand left the picture for more than 1 s */
  handLost: number;
  /** sentences shown to the person (1 + rejections) */
  attempts: number;
  success: boolean;
  endedBy: 'done' | 'gaveup';
  finalText: string;
}

export interface SurveyLog {
  participant: number;
  block: 0 | 1;
  mode: Mode;
  answers: Answers;
}

export interface ComparisonLog {
  participant: number;
  answers: Record<string, Preference>;
}

export interface StudyData {
  version: 1;
  trials: TrialLog[];
  surveys: SurveyLog[];
  comparisons: ComparisonLog[];
}

export const emptyData = (): StudyData => ({
  version: 1,
  trials: [],
  surveys: [],
  comparisons: [],
});

/** total mistakes the person had to deal with in a trial */
export const errorCount = (t: Pick<TrialLog, 'corrections' | 'rejections' | 'backs'>): number =>
  t.corrections + t.rejections + t.backs;

const esc = (v: string | number | boolean): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: (string | number | boolean)[]) => cells.map(esc).join(',');

export function trialsCsv(d: StudyData): string {
  const head = [
    'participant',
    'block',
    'mode',
    'task_set',
    'task',
    'started_at',
    'duration_ms',
    'errors',
    'corrections',
    'rejections',
    'backs',
    'hand_lost',
    'attempts',
    'success',
    'ended_by',
    'final_text',
  ];
  const lines = d.trials.map((t) =>
    row([
      t.participant,
      t.block,
      t.mode,
      t.set,
      t.taskId,
      new Date(t.startedAt).toISOString(),
      t.durationMs,
      errorCount(t),
      t.corrections,
      t.rejections,
      t.backs,
      t.handLost,
      t.attempts,
      t.success,
      t.endedBy,
      t.finalText,
    ]),
  );
  return [row(head), ...lines].join('\n') + '\n';
}

export function surveyCsv(d: StudyData): string {
  const head = ['participant', 'block', 'mode', ...ITEMS.map((i) => i.id)];
  const lines = d.surveys.map((s) =>
    row([s.participant, s.block, s.mode, ...ITEMS.map((i) => s.answers[i.id] ?? '')]),
  );
  return [row(head), ...lines].join('\n') + '\n';
}

export function comparisonCsv(d: StudyData): string {
  const ids = ['cmp_easier', 'cmp_enjoy', 'cmp_choose'];
  const lines = d.comparisons.map((c) =>
    row([c.participant, ...ids.map((id) => c.answers[id] ?? '')]),
  );
  return [row(['participant', ...ids]), ...lines].join('\n') + '\n';
}

export interface ModeSummary {
  mode: Mode;
  trials: number;
  successRate: number | null;
  meanDurationMs: number | null;
  meanErrors: number | null;
  meanAttempts: number | null;
}

/** per-mode means over all participants; numbers come only from logged trials, never from assumptions */
export function summarize(d: StudyData): ModeSummary[] {
  return (['camera', 'keyboard'] as const).map((mode) => {
    const t = d.trials.filter((x) => x.mode === mode);
    const mean = (f: (x: TrialLog) => number) =>
      t.length ? t.reduce((s, x) => s + f(x), 0) / t.length : null;
    return {
      mode,
      trials: t.length,
      successRate: t.length ? t.filter((x) => x.success).length / t.length : null,
      meanDurationMs: mean((x) => x.durationMs),
      meanErrors: mean(errorCount),
      meanAttempts: mean((x) => x.attempts),
    };
  });
}

const KEY = 'signscribe.study.v1';

export function loadData(): StudyData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const p = JSON.parse(raw) as Partial<StudyData>;
    if (p.version !== 1 || !Array.isArray(p.trials) || !Array.isArray(p.surveys))
      return emptyData();
    return {
      version: 1,
      trials: p.trials,
      surveys: p.surveys,
      comparisons: Array.isArray(p.comparisons) ? p.comparisons : [],
    };
  } catch {
    return emptyData();
  }
}

export function saveData(d: StudyData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore: the facilitator can still export from memory */
  }
}
