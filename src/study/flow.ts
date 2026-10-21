import { planFor, type Plan } from './design';
import type { Answers, Preference } from './survey';
import { emptyData, type ComparisonLog, type StudyData, type TrialLog } from './log';

/**
 * Where a participant is in the session. Pure, so the whole protocol is testable:
 *   setup -> (task 1..3 of block 0) -> survey 0 -> (task 1..3 of block 1) -> survey 1 -> comparison -> done
 */
export type Phase =
  | { kind: 'setup' }
  | { kind: 'ready'; block: 0 | 1; task: number }
  | { kind: 'running'; block: 0 | 1; task: number; startedAt: number }
  | { kind: 'survey'; block: 0 | 1 }
  | { kind: 'compare' }
  | { kind: 'done' };

export interface StudyState {
  plan: Plan | null;
  phase: Phase;
  data: StudyData;
}

export const TASKS_PER_BLOCK = 3;

export type Action =
  | { type: 'START'; participant: number }
  | { type: 'BEGIN'; now: number }
  | {
      type: 'END';
      trial: Omit<TrialLog, 'participant' | 'block' | 'mode' | 'set' | 'taskId' | 'startedAt'>;
    }
  | { type: 'SURVEY'; answers: Answers }
  | { type: 'COMPARE'; answers: Record<string, Preference> }
  | { type: 'RESET' };

export const initialState = (data = emptyData()): StudyState => ({
  plan: null,
  phase: { kind: 'setup' },
  data,
});

export function studyReducer(s: StudyState, a: Action): StudyState {
  const { plan, phase } = s;
  switch (a.type) {
    case 'START':
      return { ...s, plan: planFor(a.participant), phase: { kind: 'ready', block: 0, task: 0 } };
    case 'BEGIN':
      if (phase.kind !== 'ready') return s;
      return {
        ...s,
        phase: { kind: 'running', block: phase.block, task: phase.task, startedAt: a.now },
      };
    case 'END': {
      if (phase.kind !== 'running' || !plan) return s;
      const b = plan.blocks[phase.block];
      const trial: TrialLog = {
        ...a.trial,
        participant: plan.participant,
        block: phase.block,
        mode: b.mode,
        set: b.set,
        taskId: taskId(b.set, phase.task),
        startedAt: phase.startedAt,
      };
      const next: Phase =
        phase.task + 1 < TASKS_PER_BLOCK
          ? { kind: 'ready', block: phase.block, task: phase.task + 1 }
          : { kind: 'survey', block: phase.block };
      return { ...s, phase: next, data: { ...s.data, trials: [...s.data.trials, trial] } };
    }
    case 'SURVEY': {
      if (phase.kind !== 'survey' || !plan) return s;
      const survey = {
        participant: plan.participant,
        block: phase.block,
        mode: plan.blocks[phase.block].mode,
        answers: a.answers,
      };
      const next: Phase =
        phase.block === 0 ? { kind: 'ready', block: 1, task: 0 } : { kind: 'compare' };
      return { ...s, phase: next, data: { ...s.data, surveys: [...s.data.surveys, survey] } };
    }
    case 'COMPARE': {
      if (phase.kind !== 'compare' || !plan) return s;
      const c: ComparisonLog = { participant: plan.participant, answers: a.answers };
      return {
        ...s,
        phase: { kind: 'done' },
        data: { ...s.data, comparisons: [...s.data.comparisons, c] },
      };
    }
    case 'RESET':
      return { plan: null, phase: { kind: 'setup' }, data: s.data };
  }
}

const taskId = (set: 'A' | 'B', i: number) => `${set}${i + 1}`;
