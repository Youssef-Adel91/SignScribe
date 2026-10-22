import { FEATURES_ID, FEATURE_LENGTH, staticFeatures } from './features';
import { ModelError, type LetterGuess, type StaticRecognizer } from './types';

/** The JSON file written by ml/train_knn.py. Documented in docs/MODEL_FORMAT.md. */
export interface KnnModel {
  format: 'signscribe-model';
  version: 1;
  type: 'knn';
  features: typeof FEATURES_ID;
  k: number;
  labels: string[];
  /** one row per stored sample, FEATURE_LENGTH numbers each */
  vectors: number[][];
  /** label index per row */
  y: number[];
  meta: ModelMeta;
}

export interface ModelMeta {
  trainedAt: string;
  datasetSha256: string;
  takes: number;
  signers: number;
  /** true when the model was trained on generated test data: it must never be used for a real study */
  synthetic: boolean;
  /** present only when it was measured by the training script on the dataset it names */
  evaluation: Record<string, unknown> | null;
}

export function parseKnnModel(raw: unknown): KnnModel {
  const m = raw as Partial<KnnModel> | null;
  if (!m || typeof m !== 'object')
    throw new ModelError('The letter model file is not valid JSON data.');
  if (m.format !== 'signscribe-model' || m.type !== 'knn')
    throw new ModelError('This file is not a SignScribe k-NN letter model.');
  if (m.version !== 1)
    throw new ModelError(`Unsupported letter model version ${String(m.version)}.`);
  if (m.features !== FEATURES_ID)
    throw new ModelError(
      `The model uses features "${String(m.features)}", this app uses "${FEATURES_ID}".`,
    );
  if (!Array.isArray(m.labels) || m.labels.length < 2)
    throw new ModelError('The letter model has fewer than 2 letters.');
  if (
    !Array.isArray(m.vectors) ||
    !Array.isArray(m.y) ||
    m.vectors.length !== m.y.length ||
    m.vectors.length === 0
  )
    throw new ModelError('The letter model has no samples, or vectors and labels do not match.');
  if (!Number.isInteger(m.k) || (m.k as number) < 1)
    throw new ModelError('The letter model has an invalid k.');
  for (const v of m.vectors) {
    if (
      !Array.isArray(v) ||
      v.length !== FEATURE_LENGTH ||
      v.some((n) => typeof n !== 'number' || !Number.isFinite(n))
    )
      throw new ModelError(`Every sample must have ${FEATURE_LENGTH} finite numbers.`);
  }
  const n = m.labels.length;
  if (m.y.some((i) => !Number.isInteger(i) || i < 0 || i >= n))
    throw new ModelError('A sample points at a letter that does not exist.');
  if (!m.meta || typeof m.meta !== 'object')
    throw new ModelError('The letter model has no metadata.');
  return m as KnnModel;
}

const EPS = 1e-6;
/** how many alternatives are reported besides the best guess */
const ALTERNATIVES = 2;

/**
 * k nearest neighbours on the hand60 features. Each neighbour votes with weight 1/(distance+eps);
 * confidence is the winner's share of the total weight (0..1). It is a vote share, NOT a probability
 * of being right: whether a threshold on it is good is only known after measuring on real data.
 */
export class KnnRecognizer implements StaticRecognizer {
  readonly id = 'knn';
  constructor(readonly model: KnnModel) {}

  recognizeFeatures(f: readonly number[]): LetterGuess | null {
    const { vectors, y, labels, k } = this.model;
    // keep the k smallest distances without sorting everything
    const best: { d: number; y: number }[] = [];
    for (let i = 0; i < vectors.length; i++) {
      const v = vectors[i];
      let s = 0;
      for (let j = 0; j < FEATURE_LENGTH; j++) {
        const d = v[j] - f[j];
        s += d * d;
      }
      if (best.length < k || s < best[best.length - 1].d) {
        best.push({ d: s, y: y[i] });
        best.sort((a, b) => a.d - b.d);
        if (best.length > k) best.pop();
      }
    }
    const votes = new Map<number, number>();
    let total = 0;
    for (const b of best) {
      const w = 1 / (Math.sqrt(b.d) + EPS);
      votes.set(b.y, (votes.get(b.y) ?? 0) + w);
      total += w;
    }
    if (total <= 0) return null;
    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const [top, ...rest] = ranked;
    return {
      letter: labels[top[0]],
      confidence: top[1] / total,
      alternatives: rest
        .slice(0, ALTERNATIVES)
        .map(([i, w]) => ({ letter: labels[i], confidence: w / total })),
    };
  }

  recognize(
    hand: Parameters<StaticRecognizer['recognize']>[0],
    width: number,
    height: number,
    mirrorX: boolean,
  ) {
    const f = staticFeatures(hand, width, height, mirrorX);
    return f ? this.recognizeFeatures(f) : null;
  }
}
