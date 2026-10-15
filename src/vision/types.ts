/** Shared types for the vision pipeline. Landmark coordinates are MediaPipe's: x, y in 0..1 of the (un-mirrored) frame, y grows downwards. */

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandObs {
  /** 21 MediaPipe hand landmarks */
  landmarks: Landmark[];
  /** the label MediaPipe gives. Only used to keep two hands apart over time, never to decide anything else. */
  handedness: 'Left' | 'Right';
  score: number;
}

export interface HandFrame {
  /** ms, monotonic */
  t: number;
  hands: HandObs[];
  /** video size in pixels: needed because x and y are normalised separately */
  width: number;
  height: number;
}

export type GestureLabel = 'open' | 'fist' | 'up' | 'down' | 'point' | 'none';

export interface GestureResult {
  label: GestureLabel;
  /** 0..1, how clearly the pose matches. Below the accept threshold the label is 'none'. */
  confidence: number;
  scores: Record<Exclude<GestureLabel, 'none'>, number>;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
