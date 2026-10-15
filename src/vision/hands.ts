import type { HandObs, Landmark } from './types';

/** Where `npm run models` puts the files. They are not in git (about 8 MB model + 20 MB runtime). */
export const MODEL_BASE = '/models';
export const MODEL_FILE = `${MODEL_BASE}/hand_landmarker.task`;
export const WASM_DIR = `${MODEL_BASE}/wasm`;

export class ModelMissingError extends Error {
  constructor() {
    super('Hand model not found. Run `npm run models`, then reload.');
  }
}

export interface HandTracker {
  /** run the model on the current video frame; ms = how long it took */
  detect(video: HTMLVideoElement, tMs: number): { hands: HandObs[]; ms: number };
  delegate: 'GPU' | 'CPU';
  close(): void;
}

/**
 * The dev server answers a missing file with index.html and status 200, so a plain 200 is not proof
 * that the file exists: also check that it is not an HTML page.
 */
async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    if (!r.ok) return false;
    const type = r.headers.get('content-type') ?? '';
    return !type.includes('text/html');
  } catch {
    return false;
  }
}

export async function createHandTracker(): Promise<HandTracker> {
  const [modelOk, wasmOk] = await Promise.all([
    exists(MODEL_FILE),
    exists(`${WASM_DIR}/vision_wasm_internal.wasm`),
  ]);
  if (!modelOk || !wasmOk) throw new ModelMissingError();

  // loaded only now so the app still starts (and shows a clear message) without the files
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM_DIR);
  const make = (delegate: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_FILE, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  let delegate: 'GPU' | 'CPU' = 'GPU';
  let landmarker;
  try {
    landmarker = await make('GPU');
  } catch {
    delegate = 'CPU';
    landmarker = await make('CPU');
  }
  const lm = landmarker;
  return {
    delegate,
    detect(video, tMs) {
      const t0 = performance.now();
      const res = lm.detectForVideo(video, tMs);
      const ms = performance.now() - t0;
      const hands: HandObs[] = res.landmarks.map((pts, i) => ({
        landmarks: pts.map((p): Landmark => ({ x: p.x, y: p.y, z: p.z })),
        handedness: res.handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right',
        score: res.handedness[i]?.[0]?.score ?? 0,
      }));
      return { hands, ms };
    },
    close: () => lm.close(),
  };
}
