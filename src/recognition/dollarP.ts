import { ModelError, type MotionGuess, type MotionRecognizer } from './types';

/**
 * $P point-cloud recognizer: the algorithm of the `dollarpy` package used in the labs (resample to n
 * points, scale to a unit box, move the centroid to the origin, greedy cloud matching). It is a port
 * of dollarpy 0.1.1 and ml/signscribe_ml/dollar.py, checked against both by golden tests.
 * Strokes are not used: a signed motion is one path.
 */
export interface Pt {
  x: number;
  y: number;
}

export const N_POINTS = 32;
const EPSILON = 0.5;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(p: Pt[]): number {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += dist(p[i - 1], p[i]);
  return d;
}

export function resample(input: Pt[], n = N_POINTS): Pt[] {
  const points = input.map((p) => ({ ...p }));
  const I = pathLength(points) / (n - 1);
  let D = 0;
  const out: Pt[] = [{ ...points[0] }];
  let i = 1;
  while (i < points.length) {
    const d = dist(points[i - 1], points[i]);
    if (D + d >= I && d > 0) {
      const t = (I - D) / d;
      const q = {
        x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
        y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
      };
      out.push(q);
      points.splice(i, 0, q);
      D = 0;
    } else {
      D += d;
    }
    i++;
  }
  if (out.length === n - 1) out.push({ ...points[points.length - 1] });
  return out;
}

export function scaleToUnit(p: Pt[]): Pt[] {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const q of p) {
    xMin = Math.min(xMin, q.x);
    xMax = Math.max(xMax, q.x);
    yMin = Math.min(yMin, q.y);
    yMax = Math.max(yMax, q.y);
  }
  const s = Math.max(xMax - xMin, yMax - yMin);
  const k = s > 0 ? s : 1; // a path that never moves stays a point
  return p.map((q) => ({ x: (q.x - xMin) / k, y: (q.y - yMin) / k }));
}

export function toOrigin(p: Pt[]): Pt[] {
  const cx = p.reduce((s, q) => s + q.x, 0) / p.length;
  const cy = p.reduce((s, q) => s + q.y, 0) / p.length;
  return p.map((q) => ({ x: q.x - cx, y: q.y - cy }));
}

export const normalize = (p: Pt[], n = N_POINTS): Pt[] => toOrigin(scaleToUnit(resample(p, n)));

function cloudDistance(a: Pt[], b: Pt[], n: number, start: number): number {
  const matched = new Array<boolean>(n).fill(false);
  let sum = 0;
  let i = start;
  do {
    let min = Infinity;
    let idx = -1;
    for (let j = 0; j < n; j++) {
      if (matched[j]) continue;
      const d = dist(a[i], b[j]);
      if (d < min) {
        min = d;
        idx = j;
      }
    }
    matched[idx] = true;
    const weight = 1 - ((i - start + n) % n) / n;
    sum += weight * min;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}

export function greedyCloudMatch(a: Pt[], b: Pt[], n = N_POINTS): number {
  const step = Math.floor(Math.pow(n, 1 - EPSILON));
  let min = Infinity;
  for (let i = 0; i < n; i += step) {
    min = Math.min(min, cloudDistance(a, b, n, i), cloudDistance(b, a, n, i));
  }
  return min;
}

export interface DollarModel {
  format: 'signscribe-model';
  version: 1;
  type: 'dollarP';
  /** landmark index whose path the templates are made from */
  landmark: number;
  n: number;
  templates: { label: string; points: [number, number][] }[];
  meta: import('./knn').ModelMeta;
}

export function parseDollarModel(raw: unknown): DollarModel {
  const m = raw as Partial<DollarModel> | null;
  if (!m || typeof m !== 'object')
    throw new ModelError('The motion model file is not valid JSON data.');
  if (m.format !== 'signscribe-model' || m.type !== 'dollarP')
    throw new ModelError('This file is not a SignScribe $P motion model.');
  if (m.version !== 1)
    throw new ModelError(`Unsupported motion model version ${String(m.version)}.`);
  if (!Number.isInteger(m.landmark) || (m.landmark as number) < 0 || (m.landmark as number) > 20)
    throw new ModelError('The motion model names an invalid landmark.');
  if (!Number.isInteger(m.n) || (m.n as number) < 8)
    throw new ModelError('The motion model has an invalid point count.');
  if (!Array.isArray(m.templates) || m.templates.length === 0)
    throw new ModelError('The motion model has no templates.');
  for (const t of m.templates) {
    if (typeof t.label !== 'string' || !Array.isArray(t.points) || t.points.length < 2)
      throw new ModelError('A motion template is incomplete.');
    for (const p of t.points)
      if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => Number.isFinite(v)))
        throw new ModelError('A motion template has a point that is not a pair of numbers.');
  }
  if (!m.meta || typeof m.meta !== 'object')
    throw new ModelError('The motion model has no metadata.');
  return m as DollarModel;
}

export class DollarRecognizer implements MotionRecognizer {
  readonly id = 'dollarP';
  readonly landmark: number;
  private readonly templates: { label: string; points: Pt[] }[];
  private readonly n: number;
  constructor(readonly model: DollarModel) {
    this.landmark = model.landmark;
    this.n = model.n;
    // templates are stored as recorded; normalising them here keeps the file easy to read and edit
    this.templates = model.templates.map((t) => ({
      label: t.label,
      points: normalize(
        t.points.map(([x, y]) => ({ x, y })),
        model.n,
      ),
    }));
  }

  recognize(path: Pt[]): MotionGuess | null {
    if (path.length < 2 || pathLength(path) <= 1e-9) return null;
    const pts = normalize(path, this.n);
    let best = Infinity;
    let label: string | null = null;
    for (const t of this.templates) {
      const d = greedyCloudMatch(pts, t.points, this.n);
      if (d < best) {
        best = d;
        label = t.label;
      }
    }
    const score = Math.max((2 - best) / 2, 0);
    return label === null || score === 0 ? null : { letter: label, score };
  }
}
