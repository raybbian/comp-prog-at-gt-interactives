import type { ReactNode } from 'react';
import { cn } from '@cpatgt/shared';

export type RevealProps = {
  /** Milliseconds after load. Bands come in reading order, not all at once. */
  delay: number;
  className?: string;
  children: ReactNode;
};

/**
 * Entrance only — it plays once when the poster is put up on the screen and never
 * again. Everything that moves for the rest of the day loops on its own.
 */
export function Reveal({ delay, className, children }: RevealProps) {
  return (
    <div className={cn('animate-rise-in', className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
