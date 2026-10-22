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
import { PROFILE, profileComplete, type SessionMeta } from '../src/study/profile';
import { profileCsv, scoresCsv, sessionCsv } from '../src/study/log';
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
  it('the two sets share no word at all', () => {
    const words = (id: 'A' | 'B') => new Set(TASK_SETS[id].flatMap((t) => t.words));
    const shared = [...words('A')].filter((w) => words('B').has(w));
    expect(shared).toEqual([]);
  });
  it('no word repeats inside a set either', () => {
    for (const set of Object.values(TASK_SETS)) {
      const all = set.flatMap((t) => t.words);
      expect(new Set(all).size).toBe(all.length);
    }
  });
  it('letter counts are matched task by task (within 1 letter) and in total (within 2)', () => {
    const len = (t: (typeof TASK_SETS)['A'][number]) => t.words.join('').length;
    TASK_SETS.A.forEach((a, i) =>
      expect(
        Math.abs(len(a) - len(TASK_SETS.B[i])),
        `${a.id} vs ${TASK_SETS.B[i].id}`,
      ).toBeLessThanOrEqual(1),
    );
    const total = (set: (typeof TASK_SETS)['A']) => set.reduce((s, t) => s + len(t), 0);
    expect(Math.abs(total(TASK_SETS.A) - total(TASK_SETS.B))).toBeLessThanOrEqual(2);
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
  cameraFps: null,
  inferMsMean: null,
  delegate: null,
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
      cameraFps: null,
      inferMsMean: null,
      delegate: null,
    },
  };
  const META: SessionMeta = {
    participant: 1,
    startedAt: 1_700_000_000_000,
    appVersion: 'abc123',
    userAgent: 'test',
    screen: '1440x900',
    cores: 8,
    textSize: 'normal',
    contrast: 'standard',
    dwell: 'auto',
    voice: true,
    signingHand: 'right',
  };
  const PROFILE_ACTION = (participant = 1): Action => ({
    type: 'PROFILE',
    answers: Object.fromEntries(PROFILE.map((q) => [q.id, q.options[0].value])),
    session: { ...META, participant },
    at: '2026-01-01T00:00:00.000Z',
  });
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
    expect(s.phase).toEqual({ kind: 'profile' });
    s = run(s, PROFILE_ACTION());
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
    expect(s.data.profiles).toHaveLength(1);
    expect(s.data.sessions[0]).toMatchObject({ participant: 1, appVersion: 'abc123' });
  });
  it('ignores actions that do not fit the current phase', () => {
    const s0 = initialState();
    expect(studyReducer(s0, END)).toBe(s0);
    const s1 = run(s0, { type: 'START', participant: 0 });
    expect(studyReducer(s1, { type: 'SURVEY', answers })).toBe(s1);
    expect(studyReducer(s1, END)).toBe(s1);
    expect(studyReducer(s1, { type: 'BEGIN', now: 1 })).toBe(s1); // the profile comes first
    const s2 = run(s1, PROFILE_ACTION(0));
    expect(studyReducer(s2, PROFILE_ACTION(0))).toBe(s2); // only once
  });
  it('RESET keeps the collected data', () => {
    const s = run(
      initialState(),
      { type: 'START', participant: 0 },
      PROFILE_ACTION(0),
      { type: 'BEGIN', now: 1 },
      END,
      { type: 'RESET' },
    );
    expect(s.phase.kind).toBe('setup');
    expect(s.data.trials).toHaveLength(1);
  });
});

describe('profile and session records', () => {
  it('every background question is closed and the scale question has a neutral middle', () => {
    for (const q of PROFILE) expect(q.options.length).toBeGreaterThanOrEqual(2);
    const kbm = PROFILE.find((q) => q.id === 'kbm')!;
    expect(kbm.options[2].label).toMatch(/neither/i);
    expect(PROFILE.find((q) => q.id === 'age')!.options.some((o) => o.value === 'na')).toBe(true);
  });
  it('an answer must be one of the offered options', () => {
    const ok = Object.fromEntries(PROFILE.map((q) => [q.id, q.options[0].value]));
    expect(profileComplete(ok)).toBe(true);
    expect(profileComplete({ ...ok, age: 'banana' })).toBe(false);
    expect(profileComplete({ age: '18-24' })).toBe(false);
  });
  const data = () => ({
    ...emptyData(),
    profiles: [
      {
        participant: 3,
        answers: {
          age: '18-24',
          writing_hand: 'left',
          sign_language: 'none',
          gesture_ui: 'never',
          kbm: '4',
        },
        consent: true as const,
        at: '2026-01-01T00:00:00.000Z',
      },
    ],
    sessions: [
      {
        participant: 3,
        startedAt: 1_700_000_000_000,
        appVersion: 'abc',
        userAgent: 'UA, with comma',
        screen: '1x1',
        cores: null,
        textSize: 'large',
        contrast: 'high',
        dwell: 'slow',
        voice: false,
        signingHand: 'left',
      },
    ],
    surveys: [
      {
        participant: 3,
        block: 0 as const,
        mode: 'camera' as const,
        answers: Object.fromEntries(ITEMS.map((i) => [i.id, 4])) as Answers,
      },
    ],
  });
  it('profile and session CSV have a header and one line, with commas escaped', () => {
    expect(profileCsv(data()).trim().split('\n')).toHaveLength(2);
    const s = sessionCsv(data()).trim().split('\n');
    expect(s).toHaveLength(2);
    expect(s[1]).toContain('"UA, with comma"');
  });
  it('scores CSV has the mean per dimension for each participant and method', () => {
    const [h, r] = scoresCsv(data()).trim().split('\n');
    expect(h).toBe('participant,block,mode,satisfaction,engagement,usability');
    expect(r).toBe('3,0,camera,4.000,4.000,4.000');
  });
  it('trial CSV carries camera numbers only when they were measured', () => {
    const lines = trialsCsv({
      ...emptyData(),
      trials: [
        trial({ cameraFps: 27.456, inferMsMean: 12.3456, delegate: 'GPU' }),
        trial({ mode: 'keyboard' }),
      ],
    })
      .trim()
      .split('\n');
    expect(lines[0]).toContain('camera_fps,model_ms_mean,delegate');
    expect(lines[1]).toContain('27.46,12.35,GPU');
    expect(lines[2]).toMatch(/,,,"Doctor/);
  });
});
