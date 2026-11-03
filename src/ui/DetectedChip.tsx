import { useEffect } from 'react';
import { useAnnounce } from '../output/announcer';
import { shouldAnnounceDetected } from './detectedAnnounce';
import { useCtx, useScreenNumber } from '../state/MachineProvider';
import { useDwellTarget } from '../vision/targets';
import { Chip } from './Chip';
import styles from './DetectedChip.module.css';

/** screens before the message starts: here a wrong detection can be overridden */
const SETUP = new Set([1, 2, 3, 4, 5, 14]);

/**
 * Shows who and where Bluetooth found, on every screen, and (on the setup screens) a point-and-hold way to say
 * "this is wrong". Renders nothing when nothing is detected, so without Bluetooth the screens are unchanged.
 */
export function DetectedChip() {
  const { detected, detectedIgnored } = useCtx();
  const screen = useScreenNumber();
  const ignoreRef = useDwellTarget(
    detected && SETUP.has(screen) ? { type: 'CONTEXT_IGNORE' } : null,
  );
  const text = detected
    ? `Bluetooth found ${detected.userId ?? 'someone'}${detected.place ? ` at ${detected.place}` : ''}${detected.demo ? ' (demo device)' : ''}`
    : null;
  const announce = useAnnounce();
  useEffect(() => {
    // once per detection: this chip is rebuilt with every screen, so the memory lives outside it (detectedAnnounce.ts)
    if (shouldAnnounceDetected(text) && text) announce(text);
  }, [text, announce]);
  if (detected) {
    return (
      <>
        <Chip kind="green">
          Bluetooth: {detected.userId ?? 'someone'}
          {detected.place ? ` · ${detected.place}` : ''}
          {detected.demo ? ' (demo device)' : ''}
        </Chip>
        {SETUP.has(screen) && (
          <li ref={ignoreRef} className={styles.ignore} data-testid="ignore-detected">
            Wrong? Point and hold here to ignore
          </li>
        )}
      </>
    );
  }
  if (detectedIgnored) return <Chip kind="gray">Bluetooth ignored</Chip>;
  return null;
}
