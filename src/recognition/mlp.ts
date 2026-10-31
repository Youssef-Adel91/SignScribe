import { FEATURES_ID, FEATURE_LENGTH, staticFeatures } from './features';
import type { ModelMeta } from './knn';
import { ModelError, type LetterGuess, type StaticRecognizer } from './types';

/**
 * The small neural network written by ml/export_mlp.py (`letters-mlp.json`, docs/MODEL_FORMAT.md): 60 features, standardised,
 * then dense layers with ReLU between them (60-64-32-C), then softmax. `w[in][out]`, `b[out]`.
 * The arithmetic is the same as ml/signscribe_ml/mlp_model.py:forward; ml/tests/golden_mlp.json is checked by both languages.
 */
export interface MlpModel {
  format: 'signscribe-model';
  version: 1;
  type: 'mlp';
  features: typeof FEATURES_ID;
  labels: string[];
  standardize: { mean: number[]; std: number[] };
  layers: { w: number[][]; b: number[] }[];
  meta: ModelMeta;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseMlpModel(raw: unknown): MlpModel {
  const m = raw as Partial<MlpModel> | null;
  if (!m || typeof m !== 'object')
    throw new ModelError('The letter model file is not valid JSON data.');
  if (m.format !== 'signscribe-model' || m.type !== 'mlp')
    throw new ModelError('This file is not a SignScribe neural-network letter model.');
  if (m.version !== 1)
    throw new ModelError(`Unsupported letter model version ${String(m.version)}.`);
  if (m.features !== FEATURES_ID)
    throw new ModelError(
      `The model uses features "${String(m.features)}", this app uses "${FEATURES_ID}".`,
    );
  if (!Array.isArray(m.labels) || m.labels.length < 2)
    throw new ModelError('The letter model has fewer than 2 letters.');
  const st = m.standardize;
  if (
    !st ||
    !Array.isArray(st.mean) ||
    !Array.isArray(st.std) ||
    st.mean.length !== FEATURE_LENGTH ||
    st.std.length !== FEATURE_LENGTH ||
    !st.mean.every(finite) ||
    !st.std.every((v) => finite(v) && v > 0)
  )
    throw new ModelError(`The model needs ${FEATURE_LENGTH} means and standard deviations.`);
  if (!Array.isArray(m.layers) || m.layers.length < 1)
    throw new ModelError('The letter model has no layers.');
  let width = FEATURE_LENGTH;
  for (const [i, L] of m.layers.entries()) {
    const out = Array.isArray(L?.b) ? L.b.length : -1;
    if (
      !Array.isArray(L?.w) ||
      L.w.length !== width ||
      out < 1 ||
      !L.w.every((r) => Array.isArray(r) && r.length === out && r.every(finite)) ||
      !L.b.every(finite)
    )
      throw new ModelError(`Layer ${i + 1} of the letter model does not have the right shape.`);
    width = out;
  }
  if (width !== m.labels.length)
    throw new ModelError('The last layer of the letter model does not match its letters.');
  if (!m.meta || typeof m.meta !== 'object')
    throw new ModelError('The letter model has no metadata.');
  return m as MlpModel;
}

/** class probabilities for one feature vector (they sum to 1) */
export function mlpForward(model: MlpModel, f: readonly number[]): number[] {
  let a = f.map((v, i) => (v - model.standardize.mean[i]) / model.standardize.std[i]);
  const last = model.layers.length - 1;
  model.layers.forEach((L, li) => {
    const out = L.b.slice();
    for (let k = 0; k < a.length; k++) {
      const ak = a[k];
      if (ak === 0) continue;
      const row = L.w[k];
      for (let j = 0; j < out.length; j++) out[j] += ak * row[j];
    }
    a = li < last ? out.map((v) => (v > 0 ? v : 0)) : out;
  });
  const max = Math.max(...a);
  const e = a.map((v) => Math.exp(v - max));
  const sum = e.reduce((s, v) => s + v, 0);
  return e.map((v) => v / sum);
}

/** how many alternatives are reported besides the best guess (same as the k-NN recognizer) */
const ALTERNATIVES = 2;

/**
 * Letter recognizer on the neural network. Its confidence is the softmax probability of the best letter. That is NOT the same
 * kind of number as the k-NN's vote share, and the thresholds in `LETTER` (letterController.ts) were set for the k-NN: they have
 * not been tuned for this model.
 */
export class MlpRecognizer implements StaticRecognizer {
  readonly id = 'mlp';
  constructor(readonly model: MlpModel) {}

  recognizeFeatures(f: readonly number[]): LetterGuess {
    const p = mlpForward(this.model, f);
    const order = p.map((v, i) => i).sort((a, b) => p[b] - p[a] || a - b);
    const { labels } = this.model;
    return {
      letter: labels[order[0]],
      confidence: p[order[0]],
      alternatives: order
        .slice(1, 1 + ALTERNATIVES)
        .map((i) => ({ letter: labels[i], confidence: p[i] })),
    };
  }

  recognize(
    hand: Parameters<StaticRecognizer['recognize']>[0],
    width: number,
    height: number,
    mirrorX: boolean,
  ): LetterGuess | null {
    const f = staticFeatures(hand, width, height, mirrorX);
    return f ? this.recognizeFeatures(f) : null;
  }
}
