import type { ReactNode } from 'react';
import { MicroLabel } from './MicroLabel';

export type ActionBarProps = {
  /** Where the game is up to, e.g. 'Your turn' or 'Kit 3'. */
  label: string;
  /** What just happened, or what to do next. */
  detail: string;
  /** The buttons, right-aligned. */
  children: ReactNode;
};

/** Fills `AppShell`'s footer slot: status on the left, actions on the right. */
export function ActionBar({ label, detail, children }: ActionBarProps) {
  return (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <MicroLabel className="text-ink">{label}</MicroLabel>
        <p aria-live="polite" className="truncate text-sm text-ink-muted">
          {detail}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </>
  );
}
