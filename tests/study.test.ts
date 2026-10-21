import { describe, expect, it } from 'vitest';
import { TASK_SETS, isSuccess, planFor } from '../src/study/design';
import {
  COMPARISON,
  ITEMS,
  LIKERT,
  comparisonOptions,
  isComplete,
  scores,
  type Answers,
} from '../src/study/survey';
import {
  emptyData,
  errorCount,
  summarize,
  surveyCsv,
  trialsCsv,
  type TrialLog,
} from '../src/study/log';
import { initialState, studyReducer, type Action, type StudyState } from '../src/study/flow';
import { WORDS } from '../src/nlp/words';
import { CARD_PACKS } from '../src/screens/cardPack';

describe('counterbalancing', () => {
  const plans = [0, 1, 2, 3].map(planFor);
  it('each mode is first for exactly half of any 4 participants', () => {
    expect(plans.filter((p) => p.blocks[0].mode === 'camera')).toHaveLength(2);
    expect(plans.filter((p) => p.blocks[0].mode === 'keyboard')).toHaveLength(2);
  });
  it('each task set is used with each mode twice, and never twice by one person', () => {
    for (const mode of ['camera', 'keyboard'] as const) {
      for (const set of ['A', 'B'] as const) {
        const n = plans.filter((p) =>
          p.blocks.some((b) => b.mode === mode && b.set === set),
        ).length;
        expect(n).toBe(2);
      }
    }
    for (const p of plans) expect(p.blocks[0].set).not.toBe(p.blocks[1].set);
  });
  it('each person does both modes, and the plan repeats every 4 participants', () => {
    for (const p of plans) expect(new Set(p.blocks.map((b) => b.mode)).size).toBe(2);
    expect(planFor(4).blocks).toEqual(planFor(0).blocks);
    expect(planFor(-1).blocks).toEqual(planFor(3).blocks);
  });
});

describe('tasks', () => {
  it('both sets have 3 tasks, with words both techniques can produce', () => {
    for (const set of Object.values(TASK_SETS)) {
      expect(set).toHaveLength(3);
      for (const t of set) {
        for (const w of t.words) {
          expect(WORDS[t.place], `${t.id} ${w} in word list`).toContain(w);
          expect(
            CARD_PACKS[t.place].map((c) => c.word.toUpperCase()),
            `${t.id} ${w} on a card`,
          ).toContain(w);
        }
      }
    }
  });
  it('no message is used in both sets', () => {
    const a = TASK_SETS.A.map((t) => t.words.join(' '));
    const b = TASK_SETS.B.map((t) => t.words.join(' '));
    expect(a.filter((x) => b.includes(x))).toEqual([]);
  });
  it('success needs every target word as a whole word', () => {
    const t = TASK_SETS.A[0];
    expect(isSuccess(t, 'Doctor, help.')).toBe(true);
    expect(isSuccess(t, 'Excuse me, doctor, help, please.')).toBe(true);
    expect(isSuccess(t, 'Doctor.')).toBe(false);
    expect(isSuccess(t, 'Doctors helps')).toBe(false);
    expect(isSuccess(t, '')).toBe(false);
  });
});

describe('survey follows the Lab 3 rules', () => {
  it('5 balanced choices with a neutral middle', () => {
    expect(LIKERT).toHaveLength(5);
    expect(LIKERT[2].label).toMatch(/neither/i);
    expect(LIKERT.map((l) => l.value)).toEqual([1, 2, 3, 4, 5]);
  });
  it('covers satisfaction, engagement and usability, and all 7 Lab 2 heuristics', () => {
    expect(new Set(ITEMS.map((i) => i.dimension))).toEqual(
      new Set(['satisfaction', 'engagement', 'usability']),
    );
    expect(new Set(ITEMS.map((i) => i.heuristic).filter(Boolean))).toEqual(
      new Set([
        'navigation',
        'familiarity',
        'consistency',
        'error',
        'feedback',
        'visual',
        'efficiency',
      ]),
    );
  });
  it('every question asks one thing (no "and"/"or" joining two questions)', () => {
    for (const i of ITEMS) {
      expect(i.text, i.id).not.toMatch(/\b(and|or)\b.*\b(and|or)\b/i);
      expect(i.text.length, i.id).toBeLessThan(90);
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });
  it('comparison questions have a neutral middle and swap sides by participant', () => {
    for (const p of [0, 1]) {
      const o = comparisonOptions(p);
      expect(o).toHaveLength(3);
      expect(o[1].value).toBe('same');
    }
    expect(comparisonOptions(0)[0].value).not.toBe(comparisonOptions(1)[0].value);
    expect(COMPARISON).toHaveLength(3);
  });
  it('scores average each dimension and tolerate missing answers', () => {
    const a = Object.fromEntries(ITEMS.map((i) => [i.id, 4])) as Answers;
    expect(isComplete(a)).toBe(true);
    expect(scores(a)).toEqual({ satisfaction: 4, engagement: 4, usability: 4 });
    expect(scores({ sat1: 5, sat2: 3 }).satisfaction).toBe(4);
    expect(scores({}).usability).toBeNull();
    expect(isComplete({ sat1: 5 })).toBe(false);
  });
});

const trial = (over: Partial<TrialLog> = {}): TrialLog => ({
  participant: 0,
  block: 0,
  mode: 'camera',
  set: 'A',
  taskId: 'A1',
  startedAt: 1_700_000_000_000,
  durationMs: 20_000,
  corrections: 1,
  rejections: 1,
  backs: 0,
  handLost: 0,
  attempts: 2,
  success: true,
  endedBy: 'done',
  finalText: 'Doctor, help.',
  ...over,
});

describe('log', () => {
  it('counts errors as corrections + rejections + backs', () =>
    expect(errorCount(trial({ corrections: 2, rejections: 1, backs: 3 }))).toBe(6));
  it('CSV has one header and one line per trial, and escapes commas and quotes', () => {
    const d = { ...emptyData(), trials: [trial({ finalText: 'Say "hi", doctor' })] };
    const lines = trialsCsv(d).trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('duration_ms');
    expect(lines[1]).toContain('"Say ""hi"", doctor"');
  });
  it('survey CSV has one column per item', () => {
    const answers = Object.fromEntries(ITEMS.map((i) => [i.id, 3])) as Answers;
    const d = {
      ...emptyData(),
      surveys: [{ participant: 1, block: 0 as const, mode: 'camera' as const, answers }],
    };
    const [h, r] = surveyCsv(d).trim().split('\n');
    expect(h.split(',')).toHaveLength(3 + ITEMS.length);
    expect(
      r
        .split(',')
        .slice(3)
        .every((x) => x === '3'),
    ).toBe(true);
  });
  it('summary uses only logged trials; empty modes are null, not 0', () => {
    const d = { ...emptyData(), trials: [trial(), trial({ success: false, durationMs: 40_000 })] };
    const [cam, kb] = summarize(d);
    expect(cam).toMatchObject({ trials: 2, successRate: 0.5, meanDurationMs: 30_000 });
    expect(kb).toMatchObject({ trials: 0, successRate: null, meanDurationMs: null });
  });
});

describe('session flow', () => {
  const END: Action = {
    type: 'END',
    trial: {
      durationMs: 1000,
      corrections: 0,
      rejections: 0,
      backs: 0,
      handLost: 0,
      attempts: 1,
      success: true,
      endedBy: 'done',
      finalText: 'x',
    },
  };
  const run = (s: StudyState, ...a: Action[]) => a.reduce(studyReducer, s);
  const answers = Object.fromEntries(ITEMS.map((i) => [i.id, 3])) as Answers;
  const doBlock = (s: StudyState) =>
    run(
      s,
      { type: 'BEGIN', now: 1 },
      END,
      { type: 'BEGIN', now: 2 },
      END,
      { type: 'BEGIN', now: 3 },
      END,
    );

  it('goes through 3 tasks, a survey, 3 tasks, a survey, the comparison, done', () => {
    let s = run(initialState(), { type: 'START', participant: 1 });
    expect(s.phase).toEqual({ kind: 'ready', block: 0, task: 0 });
    s = doBlock(s);
    expect(s.phase).toEqual({ kind: 'survey', block: 0 });
    s = run(s, { type: 'SURVEY', answers });
    expect(s.phase).toEqual({ kind: 'ready', block: 1, task: 0 });
    s = doBlock(s);
    s = run(s, { type: 'SURVEY', answers });
    expect(s.phase.kind).toBe('compare');
    s = run(s, { type: 'COMPARE', answers: { cmp_easier: 'same' } });
    expect(s.phase.kind).toBe('done');
    expect(s.data.trials).toHaveLength(6);
    expect(s.data.surveys.map((x) => x.mode)).toEqual(['keyboard', 'camera']); // participant 1: keyboard first
    expect(s.data.trials.map((t) => t.taskId)).toEqual(['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
    expect(s.data.comparisons).toHaveLength(1);
  });
  it('ignores actions that do not fit the current phase', () => {
    const s0 = initialState();
    expect(studyReducer(s0, END)).toBe(s0);
    const s1 = run(s0, { type: 'START', participant: 0 });
    expect(studyReducer(s1, { type: 'SURVEY', answers })).toBe(s1);
    expect(studyReducer(s1, END)).toBe(s1);
  });
  it('RESET keeps the collected data', () => {
    const s = run(
      initialState(),
      { type: 'START', participant: 0 },
      { type: 'BEGIN', now: 1 },
      END,
      { type: 'RESET' },
    );
    expect(s.phase.kind).toBe('setup');
    expect(s.data.trials).toHaveLength(1);
  });
});
