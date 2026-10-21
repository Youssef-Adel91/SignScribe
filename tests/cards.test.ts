import { describe, expect, it } from 'vitest';
import { CARD, CardController } from '../src/cards/controller';
import { SORT_DEFAULTS, SortTracker, hungarian, type Track } from '../src/cards/sort';
import { iou, type Detection } from '../src/cards/types';
import { decodeYolo, letterbox, nms, toTensor } from '../src/cards/yolo';
import { CARD_CLASSES, CARD_PACKS } from '../src/screens/cardPack';

describe('card packs file', () => {
  it('every card of every place is a detector class, classes are unique', () => {
    expect(new Set(CARD_CLASSES).size).toBe(CARD_CLASSES.length);
    for (const pack of Object.values(CARD_PACKS))
      for (const c of pack) expect(CARD_CLASSES).toContain(c.word);
  });
  it('every class is used by some place', () => {
    const used = new Set(Object.values(CARD_PACKS).flatMap((p) => p.map((c) => c.word)));
    expect(CARD_CLASSES.filter((c) => !used.has(c))).toEqual([]);
  });
});

describe('letterbox and tensor', () => {
  it('fits a 16:9 picture into a square with bars top and bottom', () => {
    const lb = letterbox(1280, 720, 640);
    expect(lb.scale).toBe(0.5);
    expect(lb.padX).toBe(0);
    expect(lb.padY).toBe(140);
  });
  it('turns RGBA into planar RGB in 0..1', () => {
    const t = toTensor(
      new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 51, 51, 51, 255]),
      2,
    );
    const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
    near(Array.from(t.slice(0, 4)), [1, 0, 0, 0.2]);
    near(Array.from(t.slice(4, 8)), [0, 1, 0, 0.2]);
    near(Array.from(t.slice(8, 12)), [0, 0, 1, 0.2]);
  });
});

/** builds a [1, 4+nc, N] tensor from boxes given in INPUT pixels */
function tensor(
  boxes: { cx: number; cy: number; w: number; h: number; cls: number; s: number }[],
  nc: number,
  N = 8,
) {
  const data = new Float32Array((4 + nc) * N);
  boxes.forEach((b, i) => {
    data[0 * N + i] = b.cx;
    data[1 * N + i] = b.cy;
    data[2 * N + i] = b.w;
    data[3 * N + i] = b.h;
    data[(4 + b.cls) * N + i] = b.s;
  });
  return { data, dims: [1, 4 + nc, N] };
}
const opts = { classes: 3, scoreThreshold: 0.35, iouThreshold: 0.5, maxDetections: 10 };

describe('decodeYolo', () => {
  const lb = letterbox(1280, 720, 640);
  it('maps a box back to 0..1 of the camera picture', () => {
    // a card centred in the picture: input centre (320, 320), 100 x 150 px in the 640 square
    const { data, dims } = tensor([{ cx: 320, cy: 320, w: 100, h: 150, cls: 2, s: 0.9 }], 3);
    const [d] = decodeYolo(data, dims, lb, opts);
    expect(d.classId).toBe(2);
    expect(d.score).toBeCloseTo(0.9, 5);
    expect(d.x + d.w / 2).toBeCloseTo(0.5, 5);
    expect(d.y + d.h / 2).toBeCloseTo(0.5, 5);
    expect(d.w).toBeCloseTo(100 / 0.5 / 1280, 5);
    expect(d.h).toBeCloseTo(150 / 0.5 / 720, 5);
  });
  it('drops weak boxes and merges duplicates of one class but keeps different classes', () => {
    const { data, dims } = tensor(
      [
        { cx: 320, cy: 320, w: 100, h: 150, cls: 0, s: 0.9 },
        { cx: 324, cy: 322, w: 100, h: 150, cls: 0, s: 0.7 }, // duplicate of the first
        { cx: 322, cy: 320, w: 100, h: 150, cls: 1, s: 0.6 }, // same place, other class: kept
        { cx: 100, cy: 300, w: 50, h: 50, cls: 2, s: 0.2 }, // too weak
      ],
      3,
    );
    const out = decodeYolo(data, dims, lb, opts);
    expect(out.map((d) => d.classId).sort()).toEqual([0, 1]);
  });
  it('accepts the transposed layout [1, N, 4+nc]', () => {
    const N = 4;
    const C = 7;
    const data = new Float32Array(N * C);
    [320, 320, 100, 150, 0, 0.8, 0].forEach((v, c) => (data[0 * C + c] = v));
    const [d] = decodeYolo(data, [1, N, C], lb, opts);
    expect(d.classId).toBe(1);
  });
  it('clamps boxes at the picture edge and refuses a shape that does not fit the classes', () => {
    const { data, dims } = tensor([{ cx: 5, cy: 320, w: 100, h: 100, cls: 0, s: 0.9 }], 3);
    const [d] = decodeYolo(data, dims, lb, opts);
    expect(d.x).toBe(0);
    expect(() => decodeYolo(data, [1, 9, 8], lb, opts)).toThrow(/does not match 3 classes/);
    expect(() => decodeYolo(data, [8], lb, opts)).toThrow(/Unexpected/);
  });
  it('limits the number of boxes', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      cx: 60 + i * 100,
      cy: 320,
      w: 40,
      h: 40,
      cls: 0,
      s: 0.9 - i * 0.01,
    }));
    const { data, dims } = tensor(many, 3, 8);
    expect(decodeYolo(data, dims, lb, { ...opts, maxDetections: 3 })).toHaveLength(3);
  });
  it('nms keeps the higher score', () => {
    const a: Detection = { x: 0.1, y: 0.1, w: 0.2, h: 0.2, classId: 0, score: 0.6 };
    const b: Detection = { ...a, x: 0.11, score: 0.9 };
    expect(nms([a, b], 0.5).map((d) => d.score)).toEqual([0.9]);
  });
});

describe('hungarian', () => {
  it('finds the cheapest assignment, also for rectangular costs', () => {
    expect(
      hungarian([
        [4, 1, 3],
        [2, 0, 5],
        [3, 2, 2],
      ]),
    ).toEqual([1, 0, 2]);
    expect(
      hungarian([
        [1, 9],
        [9, 1],
        [5, 5],
      ]),
    ).toEqual([0, 1, -1].map((v, i) => (i < 2 ? v : -1)));
    expect(hungarian([[7, 2, 9]])).toEqual([1]);
  });
});

const det = (cx: number, cy: number, classId = 0, score = 0.9, w = 0.15, h = 0.22): Detection => ({
  x: cx - w / 2,
  y: cy - h / 2,
  w,
  h,
  classId,
  score,
});

describe('SortTracker', () => {
  it('keeps one id for a card that moves a little, and confirms it after minHits', () => {
    const s = new SortTracker();
    let ids: number[] = [];
    for (let i = 0; i < 6; i++)
      ids = s.update([det(0.4 + i * 0.01, 0.5)], i * 100).map((t) => t.id);
    expect(ids).toHaveLength(1);
    const first = s.update([det(0.46, 0.5)], 700)[0];
    expect(first.id).toBe(ids[0]);
    expect(first.hits).toBeGreaterThanOrEqual(SORT_DEFAULTS.minHits);
  });
  it('a card seen for fewer than minHits updates is not returned', () => {
    const s = new SortTracker();
    expect(s.update([det(0.5, 0.5)], 0)).toEqual([]);
    expect(s.update([det(0.5, 0.5)], 100)).toEqual([]);
    expect(s.update([det(0.5, 0.5)], 200)).toHaveLength(1);
  });
  it('two cards keep their own ids, even when they swap sides in the list', () => {
    const s = new SortTracker();
    let last: Track[] = [];
    for (let i = 0; i < 6; i++)
      last = s.update(
        i % 2 ? [det(0.8, 0.5, 1), det(0.2, 0.5, 0)] : [det(0.2, 0.5, 0), det(0.8, 0.5, 1)],
        i * 100,
      );
    const byClass = Object.fromEntries(last.map((t) => [t.classId, t.id]));
    for (let i = 6; i < 10; i++) last = s.update([det(0.2, 0.5, 0), det(0.8, 0.5, 1)], i * 100);
    expect(Object.fromEntries(last.map((t) => [t.classId, t.id]))).toEqual(byClass);
    expect(new Set(last.map((t) => t.id)).size).toBe(2);
  });
  it('survives a short gap and forgets a card after maxMissed updates', () => {
    const s = new SortTracker();
    let id = -1;
    for (let i = 0; i < 5; i++) id = s.update([det(0.5, 0.5)], i * 100)[0]?.id ?? id;
    s.update([], 500);
    s.update([], 600);
    expect(s.update([det(0.5, 0.5)], 700)[0].id).toBe(id);
    for (let i = 0; i < SORT_DEFAULTS.maxMissed + 2; i++) s.update([], 800 + i * 100);
    for (let i = 0; i < 4; i++) s.update([det(0.5, 0.5)], 2000 + i * 100);
    expect(s.update([det(0.5, 0.5)], 2400)[0].id).not.toBe(id);
  });
  it('votes on the class: one wrong frame does not change the label', () => {
    const s = new SortTracker();
    let t: Track[] = [];
    for (let i = 0; i < 8; i++)
      t = s.update([det(0.5, 0.5, i === 4 ? 3 : 1, i === 4 ? 0.5 : 0.9)], i * 100);
    expect(t[0].classId).toBe(1);
    expect(t[0].share).toBeGreaterThan(0.8);
  });
  it('a still card has a speed near zero, a moving one does not', () => {
    const still = new SortTracker();
    let t: Track[] = [];
    for (let i = 0; i < 10; i++) t = still.update([det(0.5, 0.5)], i * 100);
    expect(t[0].speed).toBeLessThan(0.05);
    const fast = new SortTracker();
    for (let i = 0; i < 10; i++) t = fast.update([det(0.2 + i * 0.05, 0.5)], i * 100);
    expect(t[0].speed).toBeGreaterThan(CARD.maxSpeed);
  });
  it('iou sanity', () => {
    expect(iou(det(0.5, 0.5), det(0.5, 0.5))).toBeCloseTo(1, 9);
    expect(iou(det(0.2, 0.2), det(0.8, 0.8))).toBe(0);
  });
});

const doctor = CARD_CLASSES.indexOf('Doctor');
const price = CARD_CLASSES.indexOf('Price');
const track = (over: Partial<Track> = {}): Track => ({
  id: 1,
  box: { x: 0.4, y: 0.4, w: 0.2, h: 0.3 },
  hits: 5,
  missed: 0,
  classId: doctor,
  share: 1,
  score: 0.9,
  speed: 0.02,
  bornAt: 0,
  ...over,
});

/** runs the controller at 10 detector updates per second */
function run(
  c: CardController,
  from: number,
  ms: number,
  tracks: () => Track[],
  screen = 10,
  place: 'Clinic' | 'Shop' = 'Clinic',
) {
  const events: { t: number; type: string; word?: string }[] = [];
  let ui;
  for (let t = from; t < from + ms; t += 100) {
    const r = c.step(tracks(), t, { screen, place });
    ui = r.ui;
    for (const e of r.events)
      events.push({
        t,
        type: e.type,
        word: 'word' in e ? e.word : 'candidate' in e ? e.candidate.word : undefined,
      });
  }
  return { events, ui };
}

describe('CardController', () => {
  it('shows a candidate, fills the hold, adds the card once', () => {
    const c = new CardController();
    const { events } = run(c, 0, 2500, () => [track()]);
    expect(events.filter((e) => e.type === 'CARD_ADDED')).toEqual([
      { t: expect.any(Number), type: 'CARD_ADDED', word: 'Doctor' },
    ]);
    const added = events.find((e) => e.type === 'CARD_ADDED')!;
    const firstCand = events.find((e) => e.type === 'CARD_CANDIDATE')!;
    expect(firstCand.t).toBeGreaterThanOrEqual(CARD.stableMs);
    expect(added.t - firstCand.t).toBeGreaterThanOrEqual(CARD.holdMs - CARD.stableMs - 100);
  });
  it('a card that stays in view is not added again, but is after it has gone', () => {
    const c = new CardController();
    run(c, 0, 2000, () => [track()]);
    const stay = run(c, 2000, 3000, () => [track()]);
    expect(stay.events.filter((e) => e.type === 'CARD_ADDED')).toHaveLength(0);
    run(c, 5000, CARD.clearMs + 300, () => []);
    const again = run(c, 6000, 2500, () => [track({ id: 2 })]);
    expect(again.events.filter((e) => e.type === 'CARD_ADDED')).toHaveLength(1);
  });
  it('a card that is moved around is not added', () => {
    const c = new CardController();
    const { events } = run(c, 0, 4000, () => [track({ speed: CARD.maxSpeed + 0.3 })]);
    expect(events.some((e) => e.type === 'CARD_ADDED')).toBe(false);
  });
  it('a card passing through (shorter than the hold) is not added', () => {
    const c = new CardController();
    const a = run(c, 0, 700, () => [track()]);
    const b = run(c, 700, 1500, () => []);
    expect([...a.events, ...b.events].some((e) => e.type === 'CARD_ADDED')).toBe(false);
    expect(b.events.some((e) => e.type === 'CARD_LOST')).toBe(true);
  });
  it('a weak or unsure track is ignored', () => {
    const c = new CardController();
    expect(run(c, 0, 3000, () => [track({ score: CARD.minScore - 0.1 })]).events).toEqual([]);
    expect(run(c, 3000, 3000, () => [track({ share: CARD.minShare - 0.1 })]).events).toEqual([]);
  });
  it('a card from another place is not added, and is reported as foreign', () => {
    const c = new CardController();
    const { events, ui } = run(c, 0, 3000, () => [track({ classId: price })]); // Price is a Shop card
    expect(events).toEqual([]);
    expect(ui?.foreign).toBe('Price');
    const shop = run(new CardController(), 0, 2500, () => [track({ classId: price })], 10, 'Shop');
    expect(shop.events.some((e) => e.type === 'CARD_ADDED' && e.word === 'Price')).toBe(true);
  });
  it('with two cards in view the largest one is used', () => {
    const c = new CardController();
    const small = track({
      id: 1,
      box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
      classId: CARD_CLASSES.indexOf('Pain'),
    });
    const big = track({ id: 2 });
    const { events } = run(c, 0, 2500, () => [small, big]);
    expect(events.filter((e) => e.type === 'CARD_ADDED').map((e) => e.word)).toEqual(['Doctor']);
  });
  it('does nothing on other screens and resets when the screen changes', () => {
    const c = new CardController();
    expect(run(c, 0, 3000, () => [track()], 6).events).toEqual([]);
    run(c, 3000, 600, () => [track()], 10);
    run(c, 3600, 100, () => [track()], 6);
    const back = run(c, 3700, 500, () => [track()], 10);
    expect(back.events.some((e) => e.type === 'CARD_ADDED')).toBe(false);
  });
});
