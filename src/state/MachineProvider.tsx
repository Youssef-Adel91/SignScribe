import { useEffect, useRef, type ReactNode } from 'react';
import { createActorContext } from '@xstate/react';
import { screenOf, signScribeMachine, type Ctx, type Ev } from './machine';
import { feedback, setFeedbackEnabled } from '../output/feedback';
import { setSpeechEnabled } from '../output/speech';
import { loadSettings, saveSettings } from './settings';
import { saveProfile } from './profiles';

export const Machine = createActorContext(signScribeMachine);

/** Read-only tap on every event the machine receives (used by the study logger; nothing else). */
type Tap = (e: Ev, screen: number) => void;
const taps = new Set<Tap>();
export function onMachineEvent(t: Tap): () => void {
  taps.add(t);
  return () => taps.delete(t);
}

/** one sound + vibration for each written letter, from the event itself (never from a frame) */
function FeedbackOnLetter() {
  useEffect(
    () =>
      onMachineEvent((e) => {
        if (e.type === 'LETTER_CONFIRMED') feedback.letterWritten();
      }),
    [],
  );
  return null;
}

function Persist() {
  const { hand, alphabet, textSize, contrast, dwell, voice, feedback } = Machine.useSelector(
    (s) => s.context,
  );
  const person = Machine.useSelector((s) => s.context.detected?.userId ?? null);
  // the values as they were when they were last looked at: a save is made only when a VALUE changed
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const values = { hand, alphabet, textSize, contrast, dwell, voice, feedback };
    document.documentElement.dataset.textSize = textSize;
    document.documentElement.dataset.contrast = contrast;
    setSpeechEnabled(voice);
    setFeedbackEnabled(feedback);
    const now = JSON.stringify(values);
    const first = seen.current === null;
    const changed = !first && seen.current !== now;
    seen.current = now;
    // A person arriving or leaving is NOT a change of the settings: after the message has started a new person is only shown,
    // so the values on screen are still the previous person's (or the global ones) and must not be written under the new id
    // (that would overwrite their stored profile), nor copied into the global settings when the person leaves.
    // While Bluetooth recognises a person their settings are saved under their id; otherwise as always.
    if (!changed) return;
    if (person) saveProfile(person, values);
    else saveSettings(values);
  }, [hand, alphabet, textSize, contrast, dwell, voice, feedback, person]);
  return null;
}

export function MachineProvider({ children }: { children: ReactNode }) {
  return (
    <Machine.Provider
      options={{
        input: loadSettings(),
        inspect: (ie) => {
          if (taps.size === 0 || ie.type !== '@xstate.event') return;
          const snap = ie.actorRef.getSnapshot() as { value: unknown; context: Ctx } | undefined;
          if (!snap) return;
          const screen = screenOf(snap.value, snap.context);
          for (const t of taps) t(ie.event as Ev, screen);
        },
      }}
    >
      <Persist />
      <FeedbackOnLetter />
      {children}
    </Machine.Provider>
  );
}

export const useSend = (): ((e: Ev) => void) => Machine.useActorRef().send;
export const useCtx = (): Ctx => Machine.useSelector((s) => s.context);
export const useScreenNumber = (): number =>
  Machine.useSelector((s) => screenOf(s.value, s.context));
