import { describe, expect, it } from 'vitest';
import { LETTERS, fromJsonl, gaps } from '../src/collect/dataset';
import { GUIDED, GuidedRun } from '../src/collect/guided';
import { readFileSync } from 'node:fs';

const run = (counts: Record<string, number> = {}, target = 5, labels = LETTERS) =>
  new GuidedRun(labels, counts, target);

function drain(r: GuidedRun) {
  const out: string[] = [];
  for (let s = r.current(); s; s = r.current()) {
    out.push(`${s.label}${s.takeNo}/${s.ofTotal}`);
    r.saved();
  }
  return out;
}

describe('GuidedRun (5 takes per letter, nothing to click between takes)', () => {
  it('records the missing takes of each letter one after the other, in alphabet order', () => {
    const r = run({}, 2, ['A', 'B', 'C']);
    expect(r.total).toBe(6);
    expect(drain(r)).toEqual(['A1/2', 'A2/2', 'B1/2', 'B2/2', 'C1/2', 'C2/2']);
    expect(r.current()).toBeNull();
  });
  it('only fills the gaps: letters that reached the target are skipped, partial ones get what is missing', () => {
    const r = run({ A: 5, B: 3, C: 0 }, 5, ['A', 'B', 'C']);
    expect(drain(r)).toEqual(['B1/2', 'B2/2', 'C1/5', 'C2/5', 'C3/5', 'C4/5', 'C5/5']);
  });
  it('a full dataset has nothing to record', () => {
    expect(run(Object.fromEntries(LETTERS.map((l) => [l, 5]))).current()).toBeNull();
  });
  it('the first take of a letter gets a long countdown, the following ones a short one', () => {
    const r = run({}, 3, ['A']);
    const a = r.current()!;
    expect([a.newLetter, a.countdownMs]).toEqual([true, GUIDED.firstCountdownMs]);
    r.saved();
    const b = r.current()!;
    expect([b.newLetter, b.countdownMs]).toEqual([false, GUIDED.nextCountdownMs]);
    expect(GUIDED.nextCountdownMs).toBeLessThan(GUIDED.firstCountdownMs);
  });
  it('moving letters are recorded as moving takes', () => {
    const r = run({}, 1, ['A', 'J']);
    r.saved();
    expect(r.current()!.kind).toBe('dynamic');
  });
  it('a refused take is retried on the same step; three in a row stop the run; a saved take resets the count', () => {
    const r = run({}, 2, ['A']);
    expect(r.failed()).toBe('retry');
    expect(r.current()!.takeNo).toBe(1);
    r.saved();
    expect(r.failed()).toBe('retry');
    expect(r.failed()).toBe('retry');
    expect(r.failed()).toBe('stop');
  });
  it('skipping a letter leaves all its remaining takes', () => {
    const r = run({}, 3, ['A', 'B']);
    r.saved();
    r.skipLetter();
    expect(r.current()).toMatchObject({ label: 'B', takeNo: 1 });
  });
});

describe('gaps', () => {
  it('lists what is still missing per letter and nothing else', () => {
    const takes = fromJsonl(readFileSync('ml/tests/golden_takes.jsonl', 'utf8'));
    const g = gaps(takes, 2);
    expect(g.find((x) => x.label === 'B')).toEqual({ label: 'B', takes: 1, missing: 1 });
    expect(g.find((x) => x.label === 'A')).toEqual({ label: 'A', takes: 0, missing: 2 });
    expect(gaps(takes, 1).some((x) => x.label === 'B')).toBe(false);
  });
});
