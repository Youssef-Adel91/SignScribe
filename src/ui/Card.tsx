import { useId, type ReactNode } from 'react';
import styles from './Card.module.css';

export function Card({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section className={`${styles.card} ${className}`} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {children}
    </section>
  );
}
