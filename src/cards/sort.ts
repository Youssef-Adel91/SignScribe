import { iou, type Detection } from './types';

/**
 * SORT (Simple Online and Realtime Tracking): a constant-velocity Kalman filter per card and
 * Hungarian matching on box overlap, as in the paper by Bewley et al. Works in percent of the picture
 * so the noise settings of the original (pixels) stay sensible. Class votes are kept per track.
 */
type M = number[][];

const eye = (n: number): M =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const mul = (a: M, b: M): M =>
  a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
const tr = (a: M): M => a[0].map((_, j) => a.map((r) => r[j]));
const add = (a: M, b: M): M => a.map((r, i) => r.map((v, j) => v + b[i][j]));
const sub = (a: M, b: M): M => a.map((r, i) => r.map((v, j) => v - b[i][j]));

function inv(a: M): M {
  const n = a.length;
  const m = a.map((r, i) => [...r, ...eye(n)[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    const d = m[c][c] || 1e-12;
    for (let j = 0; j < 2 * n; j++) m[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c];
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((r) => r.slice(n));
}

/** state: [cx, cy, s (area), r (aspect), vcx, vcy, vs] */
const F: M = [
  [1, 0, 0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0, 0, 1],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 1],
];
const H: M = [
  [1, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];
const diag = (v: number[]): M => v.map((x, i) => v.map((_, j) => (i === j ? x : 0)));
const R = diag([1, 1, 10, 10]);
const Q = diag([1, 1, 1, 1, 0.01, 0.01, 0.0001]);
const P0 = diag([10, 10, 10, 10, 10000, 10000, 10000]);

const SCALE = 100;
function toZ(d: Detection): number[] {
  const w = d.w * SCALE;
  const h = d.h * SCALE;
  return [d.x * SCALE + w / 2, d.y * SCALE + h / 2, w * h, w / Math.max(h, 1e-6)];
}
function toBox(x: number[]): { x: number; y: number; w: number; h: number } {
  const s = Math.max(x[2], 1e-9);
  const w = Math.sqrt(s * Math.max(x[3], 1e-9));
  const h = s / Math.max(w, 1e-9);
  return { x: (x[0] - w / 2) / SCALE, y: (x[1] - h / 2) / SCALE, w: w / SCALE, h: h / SCALE };
}

export interface Track {
  id: number;
  box: { x: number; y: number; w: number; h: number };
  /** updates in which this track was matched */
  hits: number;
  /** updates since the last match (0 = matched in the latest update) */
  missed: number;
  /** best class so far (by summed score of the recent votes) and its share of the votes, 0..1 */
  classId: number;
  share: number;
  /** mean score of the recent votes for `classId` */
  score: number;
  /** speed of the centre in picture heights per second (smoothed) */
  speed: number;
  /** ms at the first update */
  bornAt: number;
}

interface Internal {
  id: number;
  x: number[];
  P: M;
  hits: number;
  missed: number;
  votes: { classId: number; score: number }[];
  speed: number;
  bornAt: number;
  lastT: number;
  /** corrected centre after the previous update, in percent */
  pos: [number, number];
}

export interface SortOptions {
  /** minimum overlap to match a detection to a track */
  iouThreshold: number;
  /** a track is dropped after this many updates without a match */
  maxMissed: number;
  /** only tracks matched at least this many times are returned */
  minHits: number;
  /** how many recent detections vote for the class */
  voteWindow: number;
}
export const SORT_DEFAULTS: SortOptions = {
  iouThreshold: 0.3,
  maxMissed: 5,
  minHits: 3,
  voteWindow: 8,
};

/** Hungarian algorithm for the assignment problem (minimise cost), rectangular matrices allowed. */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const m = n ? cost[0].length : 0;
  const size = Math.max(n, m);
  const a = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) =>
      i >= 1 && j >= 1 && i <= n && j <= m ? cost[i - 1][j - 1] : 0,
    ),
  );
  const u = new Array<number>(size + 1).fill(0);
  const v = new Array<number>(size + 1).fill(0);
  const p = new Array<number>(size + 1).fill(0);
  const way = new Array<number>(size + 1).fill(0);
  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(size + 1).fill(Infinity);
    const used = new Array<boolean>(size + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const cur = a[i0][j] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= size; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const rowToCol = new Array<number>(n).fill(-1);
  for (let j = 1; j <= size; j++) if (p[j] >= 1 && p[j] <= n && j <= m) rowToCol[p[j] - 1] = j - 1;
  return rowToCol;
}

export class SortTracker {
  private tracks: Internal[] = [];
  private nextId = 1;
  constructor(private readonly o: SortOptions = SORT_DEFAULTS) {}

  reset(): void {
    this.tracks = [];
  }

  /** feed the detections of ONE detector run; returns the confirmed tracks (matched recently, enough hits) */
  update(dets: Detection[], t: number): Track[] {
    // 1. predict
    for (const tr_ of this.tracks) {
      if (tr_.x[2] + tr_.x[6] <= 0) tr_.x[6] = 0; // area must stay positive
      tr_.x = F.map((row) => row.reduce((s, v, k) => s + v * tr_.x[k], 0));
      tr_.P = add(mul(mul(F, tr_.P), tr(F)), Q);
    }
    // 2. match by overlap
    const predicted = this.tracks.map((tk) => toBox(tk.x));
    const cost = predicted.map((pb) => dets.map((d) => 1 - iou(pb, d)));
    const assign = cost.length && dets.length ? hungarian(cost) : this.tracks.map(() => -1);
    const matchedDet = new Set<number>();
    this.tracks.forEach((tk, i) => {
      const j = assign[i];
      if (j >= 0 && 1 - cost[i][j] >= this.o.iouThreshold) {
        matchedDet.add(j);
        this.correct(tk, dets[j], t);
      } else {
        tk.missed++;
      }
    });
    // 3. new tracks for the rest
    dets.forEach((d, j) => {
      if (matchedDet.has(j)) return;
      const z = toZ(d);
      this.tracks.push({
        id: this.nextId++,
        x: [...z, 0, 0, 0],
        P: P0.map((r) => [...r]),
        hits: 1,
        missed: 0,
        votes: [{ classId: d.classId, score: d.score }],
        speed: 0,
        bornAt: t,
        lastT: t,
        pos: [z[0], z[1]],
      });
    });
    // 4. drop the old
    this.tracks = this.tracks.filter((tk) => tk.missed <= this.o.maxMissed);
    return this.tracks
      .filter((tk) => tk.hits >= this.o.minHits && tk.missed === 0)
      .map((tk) => this.view(tk));
  }

  private correct(tk: Internal, d: Detection, t: number): void {
    const z = toZ(d);
    const S = add(mul(mul(H, tk.P), tr(H)), R);
    const K = mul(mul(tk.P, tr(H)), inv(S));
    const y = z.map((v, i) => v - tk.x[i]);
    tk.x = tk.x.map((v, i) => v + K[i].reduce((s, k, j) => s + k * y[j], 0));
    tk.P = mul(sub(eye(7), mul(K, H)), tk.P);
    tk.hits++;
    tk.missed = 0;
    tk.votes.push({ classId: d.classId, score: d.score });
    if (tk.votes.length > this.o.voteWindow) tk.votes.shift();
    const dt = Math.max(1, t - tk.lastT) / 1000;
    const hPct = Math.max(toBox(tk.x).h * SCALE, 1e-6);
    // speed is measured between two corrected positions (the prediction already contains the motion)
    const inst = Math.hypot(tk.x[0] - tk.pos[0], tk.x[1] - tk.pos[1]) / hPct / dt;
    tk.pos = [tk.x[0], tk.x[1]];
    tk.speed = tk.speed * 0.6 + inst * 0.4;
    tk.lastT = t;
  }

  private view(tk: Internal): Track {
    const sums = new Map<number, { s: number; n: number }>();
    for (const v of tk.votes) {
      const e = sums.get(v.classId) ?? { s: 0, n: 0 };
      e.s += v.score;
      e.n++;
      sums.set(v.classId, e);
    }
    let best = tk.votes[tk.votes.length - 1].classId;
    let bestSum = -1;
    let total = 0;
    for (const [c, e] of sums) {
      total += e.s;
      if (e.s > bestSum) {
        bestSum = e.s;
        best = c;
      }
    }
    const e = sums.get(best)!;
    return {
      id: tk.id,
      box: toBox(tk.x),
      hits: tk.hits,
      missed: tk.missed,
      classId: best,
      share: total > 0 ? bestSum / total : 0,
      score: e.s / e.n,
      speed: tk.speed,
      bornAt: tk.bornAt,
    };
  }
}
