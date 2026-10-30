import { useEffect, useRef, useState } from 'react';
import { alphabetOfSetting } from '../config/alphabet';
import { useCtx, useScreenNumber, useSend } from '../state/MachineProvider';
import { MODE_LABEL, TASK_SETS, isSuccess, type Task } from './design';
import { TASKS_PER_BLOCK } from './flow';
import {
  comparisonCsv,
  profileCsv,
  scoresCsv,
  sessionCsv,
  summarize,
  surveyCsv,
  trialsCsv,
  type StudyData,
} from './log';
import { download } from './download';
import { KeyboardTask } from './KeyboardTask';
import { ComparisonForm, SurveyForm } from './SurveyForm';
import { useStudy } from './StudyProvider';
import { NO_CAMERA_STATS, useCameraStats, useTrialRecorder } from './useTrialRecorder';
import { ProfileForm } from './ProfileForm';
import type { SessionMeta } from './profile';
import { useCtx as useSettings } from '../state/MachineProvider';
import { Outside } from '../ui/Overlay';
import styles from './Study.module.css';

const fmtMs = (ms: number | null) => (ms === null ? 'n/a' : `${(ms / 1000).toFixed(1)} s`);
const fmt = (x: number | null, d = 2) => (x === null ? 'n/a' : x.toFixed(d));

function Exports({ data }: { data: StudyData }) {
  const stamp = new Date().toISOString().slice(0, 10);
  return (
    <p>
      <button
        type="button"
        onClick={() => download(`signscribe-trials-${stamp}.csv`, trialsCsv(data))}
      >
        Trials CSV
      </button>
      <button
        type="button"
        onClick={() => download(`signscribe-survey-${stamp}.csv`, surveyCsv(data))}
      >
        Survey CSV
      </button>
      <button
        type="button"
        onClick={() => download(`signscribe-comparison-${stamp}.csv`, comparisonCsv(data))}
      >
        Comparison CSV
      </button>
      <button
        type="button"
        onClick={() => download(`signscribe-scores-${stamp}.csv`, scoresCsv(data))}
      >
        Scores CSV
      </button>
      <button
        type="button"
        onClick={() => download(`signscribe-profile-${stamp}.csv`, profileCsv(data))}
      >
        Profile CSV
      </button>
      <button
        type="button"
        onClick={() => download(`signscribe-session-${stamp}.csv`, sessionCsv(data))}
      >
        Session CSV
      </button>
      <button
        type="button"
        onClick={() =>
          download(
            `signscribe-study-${stamp}.json`,
            JSON.stringify(data, null, 2),
            'application/json',
          )
        }
      >
        All as JSON
      </button>
    </p>
  );
}

/**
 * Facilitator console for the comparison study (only with ?study=1). It runs the protocol in
 * flow.ts, times each trial, and records the numbers. Mouse and keyboard are fine here: this is the
 * researcher's tool and the survey; the signing screens stay gesture-only.
 */
export function StudyPanel() {
  const study = useStudy();
  const screen = useScreenNumber();
  const { sentence } = useCtx();
  const send = useSend();
  const [participant, setParticipant] = useState('1');
  const [now, setNow] = useState(() => Date.now());

  const phase = study?.state.phase;
  const plan = study?.state.plan ?? null;
  const running = phase?.kind === 'running';
  const block = phase && 'block' in phase ? plan?.blocks[phase.block] : undefined;
  const cameraRunning = running && block?.mode === 'camera';
  const rec = useTrialRecorder(cameraRunning);
  const camStats = useCameraStats(cameraRunning);
  const settings = useSettings();

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  // a camera trial starts from the context screen with the settings kept (the camera stays on)
  const startedAt = phase?.kind === 'running' ? phase.startedAt : null;
  // `armed` becomes true once the restarted machine has been seen away from screen 12, so the
  // share screen left over from the previous trial cannot end the new one at once
  const armed = useRef(false);
  useEffect(() => {
    if (!cameraRunning) return;
    armed.current = false;
    send({ type: 'STUDY_RESTART' });
  }, [cameraRunning, startedAt, send]);

  // camera trial ends by itself when the person confirms the sentence (screen 12)
  const task: Task | undefined =
    phase && 'task' in phase && block ? TASK_SETS[block.set][phase.task] : undefined;
  useEffect(() => {
    if (!study || phase?.kind !== 'running' || !cameraRunning || !task) return;
    if (screen !== 12) {
      armed.current = true;
      return;
    }
    if (!armed.current) return;
    study.dispatch({
      type: 'END',
      trial: {
        durationMs: Date.now() - phase.startedAt,
        ...rec.current,
        attempts: rec.current.rejections + 1,
        success: isSuccess(task, sentence),
        endedBy: 'done',
        finalText: sentence,
        alphabet: alphabetOfSetting(settings.alphabet).id,
        ...camStats(),
      },
    });
  }, [study, phase, cameraRunning, screen, task, sentence, rec, camStats, settings.alphabet]);

  if (!study) return null;
  const { state, dispatch } = study;

  const giveUp = () => {
    if (phase?.kind !== 'running') return;
    dispatch({
      type: 'END',
      trial: {
        durationMs: Date.now() - phase.startedAt,
        ...rec.current,
        attempts: rec.current.rejections + 1,
        success: false,
        endedBy: 'gaveup',
        finalText: sentence,
        alphabet: block?.mode === 'camera' ? alphabetOfSetting(settings.alphabet).id : '',
        ...(block?.mode === 'camera' ? camStats() : NO_CAMERA_STATS),
      },
    });
  };

  if (phase?.kind === 'profile' && plan) {
    const meta = (): SessionMeta => ({
      participant: plan.participant,
      startedAt: Date.now(),
      appVersion: import.meta.env.VITE_APP_VERSION ?? 'unknown',
      userAgent: navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      cores: navigator.hardwareConcurrency ?? null,
      textSize: settings.textSize,
      contrast: settings.contrast,
      dwell: settings.dwell,
      voice: settings.voice,
      signingHand: settings.hand,
      alphabet: alphabetOfSetting(settings.alphabet).id,
    });
    return (
      <ProfileForm
        participant={plan.participant}
        onSubmit={(answers) =>
          dispatch({ type: 'PROFILE', answers, session: meta(), at: new Date().toISOString() })
        }
      />
    );
  }
  if (phase?.kind === 'survey' && plan)
    return (
      <SurveyForm
        key={`s${phase.block}`}
        mode={plan.blocks[phase.block].mode}
        onSubmit={(answers) => dispatch({ type: 'SURVEY', answers })}
      />
    );
  if (phase?.kind === 'compare' && plan)
    return (
      <ComparisonForm
        participant={plan.participant}
        onSubmit={(answers) => dispatch({ type: 'COMPARE', answers })}
      />
    );

  return (
    <>
      {running && block?.mode === 'keyboard' && task && (
        <KeyboardTask
          key={`${phase.block}-${phase.task}`}
          task={task}
          onDone={(r) =>
            dispatch({
              type: 'END',
              trial: {
                durationMs: Date.now() - phase.startedAt,
                corrections: r.corrections,
                rejections: r.rejections,
                backs: 0,
                handLost: 0,
                attempts: r.attempts,
                success: r.success,
                endedBy: 'done',
                finalText: r.finalText,
                alphabet: '',
                ...NO_CAMERA_STATS,
              },
            })
          }
        />
      )}
      <Outside>
        <aside className={styles.panel} aria-label="Study console" data-testid="study-panel">
          <h2>Study console</h2>
          {phase?.kind === 'setup' && (
            <>
              <label>
                Participant number{' '}
                <input
                  type="number"
                  min={0}
                  value={participant}
                  onChange={(e) => setParticipant(e.target.value)}
                  style={{ width: 70 }}
                />
              </label>
              <button
                type="button"
                onClick={() => dispatch({ type: 'START', participant: Number(participant) || 0 })}
              >
                Start session
              </button>
              <p>
                Trials logged so far: {state.data.trials.length}. Participants with a survey:{' '}
                {new Set(state.data.surveys.map((s) => s.participant)).size}.
              </p>
              <Exports data={state.data} />
            </>
          )}
          {plan &&
            phase &&
            (phase.kind === 'ready' || phase.kind === 'running') &&
            block &&
            task && (
              <>
                <p>
                  Participant {plan.participant}: block {phase.block + 1} of 2,{' '}
                  <strong>{MODE_LABEL[block.mode]}</strong>, task {phase.task + 1} of{' '}
                  {TASKS_PER_BLOCK}
                </p>
                <div className={styles.task}>
                  Place: <strong>{task.place}</strong>, words:{' '}
                  <strong>{task.words.join(', ')}</strong>
                </div>
                {phase.kind === 'ready' && (
                  <>
                    <p>
                      {block.mode === 'camera'
                        ? 'Camera: the app restarts at the context screen (04). Setup and settings are kept.'
                        : 'Keyboard: a plain form opens over the app.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'BEGIN', now: Date.now() })}
                    >
                      Start task
                    </button>
                  </>
                )}
                {phase.kind === 'running' && (
                  <>
                    <p>Time: {fmtMs(now - phase.startedAt)}</p>
                    <button type="button" onClick={giveUp}>
                      Participant gave up
                    </button>
                  </>
                )}
              </>
            )}
          {phase?.kind === 'done' && (
            <>
              <p>Session finished. Thank the participant.</p>
              <table>
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>n</th>
                    <th>OK</th>
                    <th>Time</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {summarize(state.data).map((m) => (
                    <tr key={m.mode}>
                      <td>{m.mode}</td>
                      <td>{m.trials}</td>
                      <td>
                        {m.successRate === null ? 'n/a' : `${Math.round(m.successRate * 100)}%`}
                      </td>
                      <td>{fmtMs(m.meanDurationMs)}</td>
                      <td>{fmt(m.meanErrors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Exports data={state.data} />
              <button type="button" onClick={() => dispatch({ type: 'RESET' })}>
                Next participant
              </button>
            </>
          )}
        </aside>
      </Outside>
      {cameraRunning && task && (
        <div
          className={styles.task}
          style={{ position: 'fixed', left: 8, top: 8, zIndex: 1400, maxWidth: 380 }}
          role="note"
        >
          Your task: at the <strong>{task.place}</strong>, say{' '}
          <strong>{task.words.join(' and ').toLowerCase()}</strong>.
        </div>
      )}
    </>
  );
}
