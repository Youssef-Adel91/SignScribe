import { useEffect, useState } from 'react';
import { AnnouncerProvider } from '../output/announcer';
import { MachineProvider, useSend } from '../state/MachineProvider';
import { PATH_TO_SCREEN } from '../state/paths';
import { DevPanel } from '../dev/DevPanel';
import { ScreenHost } from './ScreenHost';

const params = new URLSearchParams(window.location.search);
/** Developer simulator. Without ?dev=1 there is no mouse or keyboard navigation at all. */
export const DEV = params.get('dev') === '1';

function initialScreen(): number {
  if (!DEV) return 1;
  const n = Number(window.location.hash.replace('#', ''));
  return n >= 1 && n <= 13 ? n : 1;
}

/** Replays the event path to a screen on mount (dev only). */
function Replay({ screen }: { screen: number }) {
  const send = useSend();
  useEffect(() => {
    for (const e of PATH_TO_SCREEN[screen] ?? []) send(e);
  }, [screen, send]);
  return null;
}

export function App() {
  const [boot, setBoot] = useState({ key: 0, screen: initialScreen() });
  return (
    <AnnouncerProvider>
      <MachineProvider key={boot.key}>
        {DEV && <Replay screen={boot.screen} />}
        <ScreenHost />
        {DEV && <DevPanel goTo={(screen) => setBoot((b) => ({ key: b.key + 1, screen }))} />}
      </MachineProvider>
    </AnnouncerProvider>
  );
}
