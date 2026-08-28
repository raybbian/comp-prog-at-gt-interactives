import type { ReactNode } from 'react';
import logoUrl from '../assets/logo.png';
import { cn } from '../cn';
import { MicroLabel } from './MicroLabel';

export type AppShellProps = {
  /** Left of the top rail, e.g. 'CPATGT'. */
  mark: string;
  /** Right of the top rail — nim puts the game clock here. */
  trailing?: ReactNode;
  footer?: ReactNode;
  /** Width of the centred column, e.g. 'max-w-xl'. Rails always span the screen. */
  contentClassName?: string;
  children: ReactNode;
};

/**
 * Page frame every interactive shares: a thin top rail, a centred column, and an
 * optional footer rail. Both rails are fixed-height so content never shifts when
 * the trailing slot or footer changes between game states.
 */
export function AppShell({
  mark,
  trailing,
  footer,
  contentClassName = 'max-w-3xl',
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-6 md:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logoUrl} alt="" aria-hidden="true" className="size-8 shrink-0" />
          <MicroLabel className="truncate text-ink">{mark}</MicroLabel>
        </div>
        <div className="flex items-center gap-4">{trailing}</div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 md:px-10">
        <div className={cn('w-full', contentClassName)}>{children}</div>
      </main>

      {footer !== undefined && (
        <footer className="flex h-16 shrink-0 items-center border-t border-hairline px-6 md:px-10">
          <div
            className={cn(
              'mx-auto flex w-full items-center justify-between gap-4',
              contentClassName,
            )}
          >
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}
