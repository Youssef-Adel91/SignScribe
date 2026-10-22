import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './InfoRow.module.css';

export function InfoRow({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className={styles.row}>
      <span className={styles.badge}>
        <Icon name={icon} size="var(--s-24)" />
      </span>
      <span className={styles.text}>{children}</span>
    </li>
  );
}

export function InfoList({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}
