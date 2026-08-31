import type { ReactNode } from 'react';
import { cn } from '../cn';

/**
 * `sm` is the interactive default, `lg` is for screens read from across a room, and `xl`
 * is for a projector at the back of a lecture hall, where 16px is simply not there.
 */
export type MicroLabelSize = 'sm' | 'lg' | 'xl';

export type MicroLabelProps = {
  children: ReactNode;
  className?: string;
  size?: MicroLabelSize;
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3';
};

const SIZES: Record<MicroLabelSize, string> = {
  sm: 'text-micro',
  lg: 'text-[1rem] leading-none tracking-[0.14em]',
  xl: 'text-[1.75rem] leading-none tracking-[0.14em]',
};

/** Uppercase, tracked, small. Carries structure without adding weight or rules. */
export function MicroLabel({
  children,
  className,
  size = 'sm',
  as: Tag = 'span',
}: MicroLabelProps) {
  return (
    <Tag className={cn(SIZES[size], 'font-medium uppercase text-ink-faint', className)}>
      {children}
    </Tag>
  );
}
