import { iou, type Detection } from './types';

/**
 * Decoding of a YOLOv8-style detector output. The model is trained and exported to ONNX by the team
 * (see docs/CARDS.md); this file only turns its numbers into boxes, so it can be tested with made-up
 * tensors. Expected output: [1, 4 + classes, N] (centre x, centre y, width, height in INPUT pixels, then
 * one score per class). The transposed layout [1, N, 4 + classes] is accepted too.
 */
export interface Letterbox {
  scale: number;
  padX: number;
  padY: number;
  srcW: number;
  srcH: number;
}

/** how a srcW x srcH picture is fitted into a size x size square without changing its shape */
export function letterbox(srcW: number, srcH: number, size: number): Letterbox {
  const scale = Math.min(size / srcW, size / srcH);
  return { scale, padX: (size - srcW * scale) / 2, padY: (size - srcH * scale) / 2, srcW, srcH };
}

/** RGBA pixels (size x size, already letterboxed) to a CHW float tensor in 0..1 */
export function toTensor(rgba: Uint8ClampedArray | Uint8Array, size: number): Float32Array {
  const n = size * size;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[i * 4] / 255;
    out[n + i] = rgba[i * 4 + 1] / 255;
    out[2 * n + i] = rgba[i * 4 + 2] / 255;
  }
  return out;
}

export interface DecodeOptions {
  classes: number;
  scoreThreshold: number;
  iouThreshold: number;
  maxDetections: number;
}

export const DEFAULT_DECODE = {
  scoreThreshold: 0.35,
  iouThreshold: 0.5,
  maxDetections: 10,
} as const;

export function decodeYolo(
  data: ArrayLike<number>,
  dims: readonly number[],
  lb: Letterbox,
  o: DecodeOptions,
): Detection[] {
  if (dims.length !== 3 || dims[0] !== 1)
    throw new Error(`Unexpected detector output shape [${dims.join(', ')}]`);
  const C = 4 + o.classes;
  let N: number;
  let at: (c: number, i: number) => number;
  if (dims[1] === C) {
    N = dims[2];
    at = (c, i) => data[c * N + i];
  } else if (dims[2] === C) {
    N = dims[1];
    at = (c, i) => data[i * C + c];
  } else {
    throw new Error(
      `Detector output [${dims.join(', ')}] does not match ${o.classes} classes (expected a side of ${C}).`,
    );
  }
  const found: Detection[] = [];
  for (let i = 0; i < N; i++) {
    let best = -1;
    let score = -Infinity;
    for (let c = 0; c < o.classes; c++) {
      const s = at(4 + c, i);
      if (s > score) {
        score = s;
        best = c;
      }
    }
    if (!(score >= o.scoreThreshold)) continue;
    const cx = at(0, i);
    const cy = at(1, i);
    const w = at(2, i);
    const h = at(3, i);
    // back from the letterboxed square to the camera picture, then to 0..1
    const x0 = (cx - w / 2 - lb.padX) / lb.scale / lb.srcW;
    const y0 = (cy - h / 2 - lb.padY) / lb.scale / lb.srcH;
    const x1 = (cx + w / 2 - lb.padX) / lb.scale / lb.srcW;
    const y1 = (cy + h / 2 - lb.padY) / lb.scale / lb.srcH;
    const cl = (v: number) => Math.max(0, Math.min(1, v));
    const d: Detection = {
      x: cl(x0),
      y: cl(y0),
      w: cl(x1) - cl(x0),
      h: cl(y1) - cl(y0),
      classId: best,
      score,
    };
    if (d.w > 0 && d.h > 0) found.push(d);
  }
  return nms(found, o.iouThreshold).slice(0, o.maxDetections);
}

/** keep the best box of every overlapping group of the SAME class */
export function nms(dets: Detection[], iouThreshold: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const d of sorted) {
    if (kept.every((k) => k.classId !== d.classId || iou(k, d) < iouThreshold)) kept.push(d);
  }
  return kept;
}
