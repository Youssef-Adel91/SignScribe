import { useEffect, type ReactNode } from 'react';
import { createActorContext } from '@xstate/react';
import { screenOf, signScribeMachine, type Ctx, type Ev } from './machine';
import { feedback, setFeedbackEnabled } from '../output/feedback';
import { setSpeechEnabled } from '../output/speech';
import { loadSettings, saveSettings } from './settings';

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
  useEffect(() => {
    saveSettings({ hand, alphabet, textSize, contrast, dwell, voice, feedback });
    document.documentElement.dataset.textSize = textSize;
    document.documentElement.dataset.contrast = contrast;
    setSpeechEnabled(voice);
    setFeedbackEnabled(feedback);
  }, [hand, alphabet, textSize, contrast, dwell, voice, feedback]);
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
