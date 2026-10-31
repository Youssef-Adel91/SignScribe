import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REJECT_LABEL } from '../src/config/alphabet';
import {
  NONE_TAGS,
  TakeError,
  fromJsonl,
  toLine,
  validateTake,
  type Take,
} from '../src/collect/dataset';
import { RECORD, TakeRecorder } from '../src/collect/recorder';
import { loadLetters } from '../src/recognition/models';
import { makeFrame, makeHand } from '../src/vision/testing/fixtures';

const frames = Array.from({ length: 3 }, (_, i) => ({
  t: i * 60,
  lm: makeHand('fist', { cx: 0.5, cy: 0.5 }).landmarks.map(
    (l) => [l.x, l.y, l.z] as [number, number, number],
  ),
}));
const take = (over: Partial<Take> = {}): Take => ({
  v: 1,
  id: 'n1',
  label: 'none',
  kind: 'static',
  signer: 's01',
  session: 'desk',
  hand: 'right',
  width: 640,
  height: 480,
  createdAt: '2026-10-31T00:00:00Z',
  frames,
  ...over,
});

describe('"none" takes in the collection format', () => {
  it('are valid static takes, with or without a tag', () => {
    expect(validateTake(take()).label).toBe('none');
    for (const tag of NONE_TAGS) expect(validateTake(take({ tag })).tag).toBe(tag);
  });
  it('are refused with a wrong tag or as a moving take', () => {
    expect(() => validateTake(take({ tag: 'waving' as never }))).toThrow(TakeError);
    expect(() => validateTake(take({ kind: 'dynamic', frames: [...frames, ...frames] }))).toThrow(
      /static/,
    );
  });
  it('other unknown labels are still refused', () => {
    expect(() => validateTake(take({ label: 'nothing' }))).toThrow(/label must be/);
  });
  it('survive the export / import round trip', () => {
    const back = fromJsonl(toLine(take({ tag: 'moving' })) + '\n');
    expect(back[0]).toMatchObject({ label: 'none', tag: 'moving' });
  });
});

describe('recording none takes', () => {
  const record = (label: string, tag?: (typeof NONE_TAGS)[number]) => {
    const r = new TakeRecorder();
    r.start(label, { signer: 's01', session: 'desk', hand: 'right' }, 0, 'static', 0, tag ?? null);
    let t = 0;
    let s = r.state;
    while (s.kind !== 'done' && s.kind !== 'failed' && t < 10_000) {
      t += 40;
      s = r.feed(makeFrame(t, [makeHand('fist', { cx: 0.5, cy: 0.5 })]));
    }
    return s;
  };
  it('a none take carries its tag; "other" when none was given', () => {
    const s = record(REJECT_LABEL, 'command-zone');
    expect(s.kind).toBe('done');
    if (s.kind === 'done')
      expect(s.take).toMatchObject({ label: 'none', tag: 'command-zone', kind: 'static' });
    const o = record(REJECT_LABEL);
    if (o.kind === 'done') expect(o.take.tag).toBe('other');
    expect(RECORD.staticMinFrames).toBeGreaterThan(0);
  });
  it('a letter take has no tag', () => {
    const s = record('B', 'moving');
    if (s.kind === 'done') expect(s.take.tag).toBeUndefined();
  });
  it('the collection page offers the four kinds of none take', () => {
    const src = readFileSync('src/collect/CollectPanel.tsx', 'utf8');
    for (const t of NONE_TAGS) expect(src).toContain(`tag: '${t}'`);
    expect(src).toContain('data-testid="none-takes"');
  });
});

describe('a model that has a "none" class', () => {
  it('is accepted by the loader for any alphabet', async () => {
    const model = {
      format: 'signscribe-model',
      version: 1,
      type: 'knn',
      features: 'hand60-v1',
      k: 1,
      labels: ['A', 'B', 'none'],
      vectors: [Array(60).fill(0), Array(60).fill(1), Array(60).fill(2)],
      y: [0, 1, 2],
      meta: { synthetic: false },
    };
    const f = (async (url: string) =>
      String(url).endsWith('letters-knn.json')
        ? new Response(JSON.stringify(model), { headers: { 'content-type': 'application/json' } })
        : new Response('', { status: 404 })) as typeof fetch;
    expect((await loadLetters(f, 'asl')).status).toBe('ready');
  });
});
