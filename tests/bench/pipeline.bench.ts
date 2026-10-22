import { bench, describe } from 'vitest';
import { CardController } from '../../src/cards/controller';
import { SortTracker } from '../../src/cards/sort';
import { GestureController } from '../../src/vision/controller';
import { LetterController } from '../../src/recognition/letterController';
import { KnnRecognizer } from '../../src/recognition/knn';
import { staticFeatures } from '../../src/recognition/features';
import { evaluateChecks } from '../../src/vision/checks';
import { makeFrame, makeHand } from '../../src/vision/testing/fixtures';

/**
 * CPU time of OUR code per camera frame, on whatever machine runs this, with synthetic hands.
 * It leaves out the camera and the hand model. It tells you whether the logic is cheap, not how the app performs
 * for a user: for that, record on a real camera with /?perf=1 (docs/PERF.md).
 */
const hands = [
  makeHand('point', { cx: 0.3, cy: 0.5, size: 0.2 }),
  makeHand('fist', { cx: 0.8, cy: 0.5, size: 0.2 }),
];
const frame = (t: number) => makeFrame(t, hands);

describe('per frame', () => {
  const ctl = new GestureController();
  let t = 0;
  bench('gesture controller (2 hands)', () => {
    t += 33;
    ctl.step(frame(t), {
      screen: 6,
      signingHand: 'right',
      needsHand: true,
      viewport: { w: 1440, h: 900 },
      checks: evaluateChecks(120, frame(t)),
    });
  });

  const vec = Array.from({ length: 60 }, (_, i) => Math.sin(i));
  const model = {
    format: 'signscribe-model',
    version: 1,
    type: 'knn',
    features: 'hand60-v1',
    k: 5,
    labels: ['A', 'B', 'C', 'D'],
    vectors: Array.from({ length: 2000 }, (_, i) => vec.map((v) => v + (i % 7) * 0.01)),
    y: Array.from({ length: 2000 }, (_, i) => i % 4),
    meta: {
      trainedAt: '',
      datasetSha256: '',
      takes: 0,
      signers: 0,
      synthetic: true,
      evaluation: null,
    },
  } as const;
  const knn = new KnnRecognizer(model as never);
  bench('k-NN, 2000 stored samples', () => {
    const f = staticFeatures(hands[0], 1280, 720, false);
    if (f) knn.recognizeFeatures(f);
  });

  const letters = new LetterController(knn, null);
  let tl = 0;
  bench('letter controller with k-NN', () => {
    tl += 33;
    letters.step(frame(tl), { screen: 6, signingHand: 'right' });
  });

  const sort = new SortTracker();
  const cards = new CardController();
  let tc = 0;
  bench('card tracker + hold logic (3 boxes)', () => {
    tc += 100;
    const dets = [0, 1, 2].map((i) => ({
      x: 0.1 + i * 0.3,
      y: 0.3,
      w: 0.2,
      h: 0.3,
      classId: i,
      score: 0.9,
    }));
    cards.step(sort.update(dets, tc), tc, { screen: 10, place: 'Clinic' });
  });
});
