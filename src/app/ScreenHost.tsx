import { useEffect } from 'react';
import { SCREENS } from '../screens';
import { SCREEN_NAMES } from '../state/machine';
import { useScreenNumber } from '../state/MachineProvider';
import { useAnnounce } from '../output/announcer';

/** Shows the one screen the state machine says is current. Nothing else decides this. */
export function ScreenHost() {
  const n = useScreenNumber();
  const announce = useAnnounce();
  const name = SCREEN_NAMES[n - 1];
  useEffect(() => {
    document.title = `${name} · SignScribe`;
    announce(`Screen ${n} of 13: ${name}`);
  }, [n, name, announce]);
  const Current = SCREENS[n - 1];
  return (
    <div key={n} data-screen={n} className="screen-root">
      <Current />
    </div>
  );
}
