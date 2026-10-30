import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_LENGTH, staticFeatures } from '../src/recognition/features';
import { MlpRecognizer, mlpForward, parseMlpModel, type MlpModel } from '../src/recognition/mlp';
import { loadLetters } from '../src/recognition/models';
import { ModelError } from '../src/recognition/types';
import type { HandObs } from '../src/vision/types';

const golden = JSON.parse(readFileSync('ml/tests/golden_mlp.json', 'utf8'));
const model = parseMlpModel(golden.model);
const near = (a: number[], b: number[], tol = 1e-9) => {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(tol));
};

describe('mlp forward pass matches the Python model (golden file)', () => {
  it.each(golden.feature_cases.map((c: unknown, i: number) => [i, c]))(
    'feature case %i',
    (_i, c) => {
      const k = c as { features: number[]; probs: number[] };
      const p = mlpForward(model, k.features);
      near(p, k.probs, 1e-9);
      expect(p.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    },
  );
  it.each(golden.landmark_cases.map((c: unknown, i: number) => [i, c]))(
    'landmarks case %i (features and probabilities)',
    (_i, c) => {
      const k = c as {
        landmarks: number[][];
        width: number;
        height: number;
        mirror: boolean;
        features: number[];
        probs: number[];
      };
      const hand: HandObs = {
        landmarks: k.landmarks.map(([x, y, z]) => ({ x, y, z })),
        handedness: 'Right',
        score: 1,
      };
      const f = staticFeatures(hand, k.width, k.height, k.mirror)!;
      near(f, k.features, 1e-9);
      near(mlpForward(model, f), k.probs, 1e-9);
      const guess = new MlpRecognizer(model).recognize(hand, k.width, k.height, k.mirror)!;
      const best = k.probs.indexOf(Math.max(...k.probs));
      expect(guess.letter).toBe(model.labels[best]);
    },
  );
});

describe('MlpRecognizer', () => {
  it('returns the best letter and two alternatives in order', () => {
    const g = new MlpRecognizer(model).recognizeFeatures(golden.feature_cases[0].features);
    expect(g.alternatives).toHaveLength(2);
    expect(g.confidence).toBeGreaterThanOrEqual(g.alternatives[0].confidence);
    expect(g.alternatives[0].confidence).toBeGreaterThanOrEqual(g.alternatives[1].confidence);
  });
  it('returns null for a degenerate hand', () => {
    const hand: HandObs = {
      landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
      handedness: 'Right',
      score: 1,
    };
    expect(new MlpRecognizer(model).recognize(hand, 640, 480, false)).toBeNull();
  });
});

describe('parseMlpModel', () => {
  const clone = (): MlpModel => JSON.parse(JSON.stringify(golden.model));
  it('accepts the golden model', () => expect(() => parseMlpModel(clone())).not.toThrow());
  it.each<[string, (m: MlpModel) => void, RegExp]>([
    ['wrong type', (m) => ((m as { type: string }).type = 'knn'), /neural-network/],
    ['wrong version', (m) => ((m as { version: number }).version = 2), /version/],
    ['wrong features', (m) => ((m as { features: string }).features = 'x'), /features/],
    ['short mean', (m) => m.standardize.mean.pop(), /means/],
    ['zero std', (m) => (m.standardize.std[3] = 0), /standard deviations/],
    ['bad layer shape', (m) => m.layers[0].w.pop(), /Layer 1/],
    ['NaN weight', (m) => (m.layers[1].w[0][0] = NaN), /Layer 2/],
    ['labels mismatch', (m) => m.labels.pop(), /match its letters/],
  ])('rejects %s', (_n, mutate, re) => {
    const m = clone();
    mutate(m);
    expect(() => parseMlpModel(m)).toThrow(ModelError);
    expect(() => parseMlpModel(m)).toThrow(re);
  });
  it('rejects non-objects', () => expect(() => parseMlpModel(null)).toThrow(ModelError));
  it('uses the feature length constant', () =>
    expect(model.standardize.mean).toHaveLength(FEATURE_LENGTH));
});

describe('loadLetters: neural network first, k-NN as fallback', () => {
  afterEach(() => vi.restoreAllMocks());
  const knn = {
    format: 'signscribe-model',
    version: 1,
    type: 'knn',
    features: 'hand60-v1',
    k: 1,
    labels: ['a', 'b'],
    vectors: [Array(60).fill(0), Array(60).fill(1)],
    y: [0, 1],
    meta: { synthetic: false },
  };
  const reply = (body: unknown | 'missing' | 'broken') =>
    body === 'missing'
      ? new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
      : new Response(body === 'broken' ? '{nope' : JSON.stringify(body), {
          headers: { 'content-type': 'application/json' },
        });
  const fake = (mlp: unknown, k: unknown) =>
    (async (url: string) => (String(url).includes('mlp') ? reply(mlp) : reply(k))) as typeof fetch;

  it('uses the network when both files exist', async () => {
    const r = await loadLetters(fake(golden.model, knn));
    expect(r.status).toBe('ready');
    expect(r.recognizer?.id).toBe('mlp');
  });
  it('uses the k-NN when the network file is missing', async () => {
    const r = await loadLetters(fake('missing', knn));
    expect(r.recognizer?.id).toBe('knn');
  });
  it('falls back (with a warning) when the network file is broken', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = { ...golden.model, layers: [] };
    const r = await loadLetters(fake(bad, knn));
    expect(r.recognizer?.id).toBe('knn');
    expect(warn).toHaveBeenCalled();
    const r2 = await loadLetters(fake('broken', knn));
    expect(r2.recognizer?.id).toBe('knn');
  });
  it('reports the network problem when it is broken and there is no k-NN', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await loadLetters(fake({ ...golden.model, layers: [] }, 'missing'));
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/layers/);
  });
  it('says missing when neither exists', async () => {
    const r = await loadLetters(fake('missing', 'missing'));
    expect(r.status).toBe('missing');
  });
  it('reports a broken k-NN when there is no network', async () => {
    const r = await loadLetters(fake('missing', 'broken'));
    expect(r.status).toBe('error');
  });
});
