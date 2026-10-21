import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { initialState, studyReducer, type Action, type StudyState } from './flow';
import { loadData, saveData } from './log';

interface Study {
  state: StudyState;
  dispatch: (a: Action) => void;
}

const Ctx = createContext<Study | null>(null);

/** The study session lives above the state machine so that it survives the machine being restarted. */
export function StudyProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [state, dispatch] = useReducer(studyReducer, undefined, () =>
    initialState(enabled ? loadData() : undefined),
  );
  useEffect(() => {
    if (enabled) saveData(state.data);
  }, [enabled, state.data]);
  if (!enabled) return <>{children}</>;
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

/** null when the study mode is off (no ?study=1) */
export const useStudy = (): Study | null => useContext(Ctx);
