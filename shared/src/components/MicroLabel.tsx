import type { ReactNode } from 'react';
import { cn } from '../cn';

export type MicroLabelProps = {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3';
};

/** Uppercase, tracked, small. Carries structure without adding weight or rules. */
export function MicroLabel({ children, className, as: Tag = 'span' }: MicroLabelProps) {
  return (
    <Tag className={cn('text-micro font-medium uppercase text-ink-faint', className)}>
      {children}
    </Tag>
  );
}
