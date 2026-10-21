import { useEffect, type ReactNode } from 'react';
import { createActorContext } from '@xstate/react';
import { screenOf, signScribeMachine, type Ctx, type Ev } from './machine';
import { setSpeechEnabled } from '../output/speech';
import { loadSettings, saveSettings } from './settings';

export const Machine = createActorContext(signScribeMachine);

function Persist() {
  const { hand, alphabet, textSize, contrast, dwell, voice } = Machine.useSelector(
    (s) => s.context,
  );
  useEffect(() => {
    saveSettings({ hand, alphabet, textSize, contrast, dwell, voice });
    document.documentElement.dataset.textSize = textSize;
    document.documentElement.dataset.contrast = contrast;
    setSpeechEnabled(voice);
  }, [hand, alphabet, textSize, contrast, dwell, voice]);
  return null;
}

export function MachineProvider({ children }: { children: ReactNode }) {
  return (
    <Machine.Provider options={{ input: loadSettings() }}>
      <Persist />
      {children}
    </Machine.Provider>
  );
}

export const useSend = (): ((e: Ev) => void) => Machine.useActorRef().send;
export const useCtx = (): Ctx => Machine.useSelector((s) => s.context);
export const useScreenNumber = (): number =>
  Machine.useSelector((s) => screenOf(s.value, s.context));
