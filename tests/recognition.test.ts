import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FEATURE_LENGTH, staticFeatures } from '../src/recognition/features';
import { KnnRecognizer, parseKnnModel, type KnnModel } from '../src/recognition/knn';
import {
  DollarRecognizer,
  greedyCloudMatch,
  normalize,
  parseDollarModel,
  type DollarModel,
} from '../src/recognition/dollarP';
import { ModelError } from '../src/recognition/types';
import type { HandObs } from '../src/vision/types';

const golden = (name: string) => JSON.parse(readFileSync(`ml/tests/${name}`, 'utf8'));
const hand = (lm: number[][]): HandObs => ({
  landmarks: lm.map(([x, y, z]) => ({ x, y, z })),
  handedness: 'Right',
  score: 1,
});

describe('features match the Python implementation (golden file)', () => {
  const g = golden('golden_features.json');
  it.each(g.cases.map((c: unknown, i: number) => [i, c]))('case %i', (_i, c) => {
    const k = c as {
      landmarks: number[][];
      width: number;
      height: number;
      mirror: boolean;
      expected: number[];
    };
    const got = staticFeatures(hand(k.landmarks), k.width, k.height, k.mirror)!;
    expect(got).toHaveLength(FEATURE_LENGTH);
    got.forEach((v, j) => expect(v).toBeCloseTo(k.expected[j], 9));
  });
  it('returns null for a degenerate hand (wrist on the middle knuckle) and for a wrong landmark count', () => {
    const flat = Array.from({ length: 21 }, () => [0.5, 0.5, 0]);
    expect(staticFeatures(hand(flat), 640, 480)).toBeNull();
    expect(staticFeatures(hand(flat.slice(0, 20)), 640, 480)).toBeNull();
  });
});

describe('$P matches the Python implementation (golden file)', () => {
  const g = golden('golden_dollar.json');
  it('normalised points agree', () => {
    for (const c of g.cases) {
      const got = normalize(c.thin.map(([x, y]: number[]) => ({ x, y })));
      got.forEach((p, i) => {
        expect(p.x).toBeCloseTo(c.normalized[i][0], 9);
        expect(p.y).toBeCloseTo(c.normalized[i][1], 9);
      });
    }
  });
  it('cloud distances agree', () => {
    for (const p of g.pairs) {
      const a = normalize(g.cases[p.a].path.map(([x, y]: number[]) => ({ x, y })));
      const b = normalize(g.cases[p.b].thin.map(([x, y]: number[]) => ({ x, y })));
      expect(greedyCloudMatch(a, b)).toBeCloseTo(p.distance, 9);
    }
  });
});

const meta = {
  trainedAt: 'x',
  datasetSha256: 'x',
  takes: 1,
  signers: 1,
  synthetic: true,
  evaluation: null,
};
const vec = (v: number) => Array.from({ length: FEATURE_LENGTH }, () => v);
const model = (over: Partial<KnnModel> = {}): KnnModel => ({
  format: 'signscribe-model',
  version: 1,
  type: 'knn',
  features: 'hand60-v1',
  k: 3,
  labels: ['A', 'B', 'C'],
  vectors: [vec(0), vec(0.01), vec(0.02), vec(1), vec(1.01), vec(2)],
  y: [0, 0, 0, 1, 1, 2],
  meta,
  ...over,
});

describe('KnnRecognizer', () => {
  it('votes by inverse distance and reports a share, not a probability', () => {
    const r = new KnnRecognizer(model());
    const g = r.recognizeFeatures(vec(0.005))!;
    expect(g.letter).toBe('A');
    expect(g.confidence).toBeGreaterThan(0.99);
    const mixed = r.recognizeFeatures(vec(0.6))!; // between A/B neighbours
    expect(mixed.confidence).toBeLessThan(1);
    expect(mixed.alternatives.length).toBeGreaterThan(0);
    expect(mixed.alternatives.every((a) => a.confidence <= mixed.confidence)).toBe(true);
  });
  it('an exact match does not divide by zero', () => {
    const g = new KnnRecognizer(model()).recognizeFeatures(vec(1))!;
    expect(g.letter).toBe('B');
    expect(Number.isFinite(g.confidence)).toBe(true);
  });
  it('recognize() returns null for an unusable hand', () => {
    const flat = Array.from({ length: 21 }, () => [0.5, 0.5, 0]);
    expect(new KnnRecognizer(model()).recognize(hand(flat), 640, 480, false)).toBeNull();
  });
});

describe('model files are checked before use', () => {
  it('accepts a good k-NN model', () => expect(parseKnnModel(model()).labels).toHaveLength(3));
  const bad: [string, unknown, RegExp][] = [
    ['not an object', 5, /not valid/],
    ['wrong format', { ...model(), format: 'x' }, /not a SignScribe/],
    ['wrong version', { ...model(), version: 2 }, /version/],
    ['wrong features', { ...model(), features: 'hand99' }, /features/],
    ['one letter', model({ labels: ['A'] }), /fewer than 2/],
    ['mismatched lengths', model({ y: [0] }), /do not match/],
    ['short vector', model({ vectors: [[1, 2, 3]], y: [0] }), /60 finite/],
    ['NaN in a vector', model({ vectors: [vec(NaN)], y: [0] }), /finite/],
    ['bad label index', model({ y: [0, 0, 0, 1, 1, 9] }), /does not exist/],
    ['bad k', model({ k: 0 }), /invalid k/],
  ];
  it.each(bad)('rejects: %s', (_n, m, re) => {
    expect(() => parseKnnModel(m)).toThrow(ModelError);
    expect(() => parseKnnModel(m)).toThrow(re);
  });
});

const line = (f: (t: number) => [number, number], n = 40) =>
  Array.from({ length: n }, (_, i) => {
    const [x, y] = f(i / (n - 1));
    return { x, y };
  });
const toPts = (p: { x: number; y: number }[]): [number, number][] => p.map((q) => [q.x, q.y]);
const dmodel = (): DollarModel => ({
  format: 'signscribe-model',
  version: 1,
  type: 'dollarP',
  landmark: 8,
  n: 32,
  templates: [
    { label: 'J', points: toPts(line((t) => [0.5 - 0.2 * Math.max(0, t - 0.5), 0.2 + 0.6 * t])) },
    {
      label: 'Z',
      points: toPts(
        line((t) =>
          t < 0.33
            ? [0.3 + 1.2 * t, 0.3]
            : t < 0.66
              ? [0.7 - 1.2 * (t - 0.33), 0.3 + 1.2 * (t - 0.33)]
              : [0.3 + 1.2 * (t - 0.66), 0.7],
        ),
      ),
    },
  ],
  meta,
});

describe('DollarRecognizer', () => {
  const r = new DollarRecognizer(dmodel());
  it('recognises a template shape, even drawn bigger, moved and sampled differently', () => {
    const j = line(
      (t) => [100 + 200 * (0.5 - 0.2 * Math.max(0, t - 0.5)), 50 + 200 * (0.2 + 0.6 * t)],
      25,
    );
    expect(r.recognize(j)?.letter).toBe('J');
  });
  it('gives a score between 0 and 1', () => {
    const g = r.recognize(line((t) => [0.5 - 0.15 * Math.max(0, t - 0.4), 0.2 + 0.6 * t]))!;
    expect(g.score).toBeGreaterThan(0);
    expect(g.score).toBeLessThanOrEqual(1);
  });
  it('a shape unlike every template scores 0 and gives no opinion (dollarpy clamps the same way)', () => {
    expect(r.recognize(line((t) => [t, t * t]))).toBeNull();
  });
  it('no movement or too few points: no opinion, no crash', () => {
    expect(r.recognize([{ x: 1, y: 1 }])).toBeNull();
    expect(r.recognize(line(() => [0.5, 0.5]))).toBeNull();
  });
  it('rejects broken motion models', () => {
    expect(() => parseDollarModel({ ...dmodel(), landmark: 99 })).toThrow(ModelError);
    expect(() => parseDollarModel({ ...dmodel(), templates: [] })).toThrow(/no templates/);
    expect(() => parseDollarModel({ ...dmodel(), type: 'knn' })).toThrow(/not a SignScribe/);
    expect(parseDollarModel(dmodel()).templates).toHaveLength(2);
  });
});

describe('a model written by the Python exporter, used by the TypeScript recognizer', () => {
  const g = golden('golden_model.json');
  const model = parseKnnModel(g.model);
  const r = new KnnRecognizer(model);
  it('loads', () => {
    expect(model.meta.synthetic).toBe(true);
    expect(model.labels).toEqual(['A', 'B', 'C']);
  });
  it.each(g.queries.map((q: unknown, i: number) => [i, q]))(
    'query %i gives the same letter and confidence as Python',
    (_i, q) => {
      const k = q as {
        landmarks: number[][];
        width: number;
        height: number;
        label: string;
        confidence: number;
      };
      const got = r.recognize(hand(k.landmarks), k.width, k.height, false)!;
      expect(got.letter).toBe(k.label);
      expect(got.confidence).toBeCloseTo(k.confidence, 9);
    },
  );
});
