import { useVision } from './store';
import styles from './StatusBanner.module.css';

/** Plain-language message when the camera or the hand model is not available. */
export function StatusBanner() {
  const status = useVision((s) => s.status);
  const message = useVision((s) => s.message);
  if (status === 'running' || status === 'off') return null;
  const problem = status !== 'asking' && status !== 'starting';
  return (
    <div
      className={`${styles.banner} ${problem ? styles.problem : ''}`}
      role={problem ? 'alert' : 'status'}
      data-testid="vision-status"
      data-status={status}
    >
      {message}
    </div>
  );
}
