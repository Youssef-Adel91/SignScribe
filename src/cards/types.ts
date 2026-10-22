/** A detected card: box in 0..1 of the (un-mirrored) camera frame, top-left corner plus size. */
export interface Detection {
  x: number;
  y: number;
  w: number;
  h: number;
  classId: number;
  score: number;
}

export const area = (d: Pick<Detection, 'w' | 'h'>): number => d.w * d.h;

export function iou(
  a: Pick<Detection, 'x' | 'y' | 'w' | 'h'>,
  b: Pick<Detection, 'x' | 'y' | 'w' | 'h'>,
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** Anything that finds cards in a camera picture: an ONNX model today, a facilitator's clicks in a study. */
export interface CardDetector {
  readonly id: string;
  detect(source: CanvasImageSource, width: number, height: number): Promise<Detection[]>;
  close(): void;
}
