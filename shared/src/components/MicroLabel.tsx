import type { ReactNode } from 'react';
import { cn } from '../cn';

/** `lg` is for screens read from across a room; `sm` is the interactive default. */
export type MicroLabelSize = 'sm' | 'lg';

export type MicroLabelProps = {
  children: ReactNode;
  className?: string;
  size?: MicroLabelSize;
  as?: 'span' | 'div' | 'h1' | 'h2' | 'h3';
};

const SIZES: Record<MicroLabelSize, string> = {
  sm: 'text-micro',
  lg: 'text-[1rem] leading-none tracking-[0.14em]',
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
