import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';

export type ButtonVariant = 'primary' | 'quiet' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 active:brightness-95',
  quiet:
    'border border-hairline-strong text-ink hover:border-ink-muted hover:bg-ground-sunken',
  ghost: 'text-ink-muted hover:text-ink',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-[0.6875rem] tracking-[0.12em]',
  lg: 'h-14 px-8 text-[0.8125rem] tracking-[0.14em]',
};

/** Square corners on purpose: rounded pills read as consumer-app; this set is editorial. */
export function Button({
  variant = 'quiet',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium uppercase whitespace-nowrap',
        'transition-[background-color,border-color,color,filter]',
        'duration-[var(--duration-quick)] ease-quart',
        'disabled:pointer-events-none disabled:opacity-35',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}
