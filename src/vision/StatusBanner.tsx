import { useVision } from './store';
import { useStrings } from '../output/strings';
import styles from './StatusBanner.module.css';

/** Plain-language message when the camera or the hand model is not available. */
export function StatusBanner() {
  const status = useVision((s) => s.status);
  const message = useVision((s) => s.message);
  const problemCode = useVision((s) => s.cameraProblem);
  const t = useStrings();
  if (status === 'running' || status === 'off') return null;
  const isCameraStatus = status === 'denied' || status === 'nocamera' || status === 'error';
  const cameraText = isCameraStatus && problemCode ? t.cameraProblem[problemCode] : null;
  const problem = status !== 'asking' && status !== 'starting';
  return (
    <div
      className={`${styles.banner} ${problem ? styles.problem : ''}`}
      role={problem ? 'alert' : 'status'}
      data-testid="vision-status"
      data-status={status}
    >
      {cameraText ?? message}
    </div>
  );
}
