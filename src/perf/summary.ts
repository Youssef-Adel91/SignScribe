/**
 * Numbers about how the camera pipeline performed during a recording. Pure maths on the samples; the
 * numbers are only worth quoting when the recording was made on a REAL camera with real hands (the
 * summary carries `source` so a mock-camera recording can never pass for one).
 */
export interface Sample {
  /** ms, the frame's timestamp */
  t: number;
  /** ms the hand model took */
  inferMs: number;
  /** ms our own code took for this frame (gestures, letters) */
  stepMs: number;
}

export interface Dist {
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export interface PerfSummary {
  source: 'camera' | 'mock';
  frames: number;
  durationMs: number;
  /** frames / duration */
  fpsMean: number;
  /** lowest frames-per-second over any whole 1 s window */
  fpsWorstSecond: number;
  frameIntervalMs: Dist | null;
  inferMs: Dist | null;
  stepMs: Dist | null;
  /** gaps between frames longer than `STALL_MS` */
  stalls: number;
  longTasks: { count: number; totalMs: number; maxMs: number };
  /** frames in which a hand was seen / frames */
  handShare: number | null;
}

export const STALL_MS = 200;

/** nearest-rank percentile of an unsorted list */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(sorted.length, rank) - 1];
}

export function dist(values: readonly number[]): Dist | null {
  if (values.length === 0) return null;
  return {
    min: Math.min(...values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: Math.max(...values),
    mean: values.reduce((s, v) => s + v, 0) / values.length,
  };
}

export function summarize(
  samples: readonly Sample[],
  longTaskMs: readonly number[],
  source: 'camera' | 'mock',
  handFrames: number | null = null,
): PerfSummary {
  const frames = samples.length;
  const intervals: number[] = [];
  for (let i = 1; i < frames; i++) intervals.push(samples[i].t - samples[i - 1].t);
  const durationMs = frames > 1 ? samples[frames - 1].t - samples[0].t : 0;
  // worst whole second: slide over one-second windows anchored at each frame
  let worst = Infinity;
  for (let i = 0, j = 0; i < frames; i++) {
    while (j < frames && samples[j].t - samples[i].t < 1000) j++;
    if (j >= frames) break; // the last window is not a whole second
    worst = Math.min(worst, j - i);
  }
  return {
    source,
    frames,
    durationMs,
    fpsMean: durationMs > 0 ? ((frames - 1) * 1000) / durationMs : 0,
    fpsWorstSecond: Number.isFinite(worst) ? worst : 0,
    frameIntervalMs: dist(intervals),
    inferMs: dist(samples.map((s) => s.inferMs)),
    stepMs: dist(samples.map((s) => s.stepMs)),
    stalls: intervals.filter((i) => i > STALL_MS).length,
    longTasks: {
      count: longTaskMs.length,
      totalMs: longTaskMs.reduce((s, v) => s + v, 0),
      maxMs: longTaskMs.length ? Math.max(...longTaskMs) : 0,
    },
    handShare: handFrames === null || frames === 0 ? null : handFrames / frames,
  };
}

export interface PerfReport {
  version: 1;
  recordedAt: string;
  environment: {
    userAgent: string;
    cores: number | null;
    memoryGb: number | null;
    devicePixelRatio: number;
    screen: string;
    video: string;
    delegate: 'GPU' | 'CPU' | null;
  };
  summary: PerfSummary;
}

/** one-line verdict text for the panel; says clearly when the recording does not count as a camera measurement */
export function provenance(s: PerfSummary): string {
  if (s.source === 'mock')
    return 'Mock camera: these numbers describe synthetic hands, NOT a camera. Do not quote them.';
  if (s.frames < 100) return 'Too few frames for a reliable summary; record longer.';
  return 'Measured on a real camera. Quote together with the environment (device, light, distance).';
}
