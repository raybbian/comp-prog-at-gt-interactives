import { useEffect, useState } from 'react';

/**
 * Milliseconds left on a deadline the server owns.
 *
 * Phones' clocks are wrong. Not by much, usually, but a phone forty seconds out would
 * show a round ending forty seconds early for its whole duration, and the two halves of
 * a team would see different clocks — so the deadline is a server timestamp and the
 * client renders it through the offset it measured, never against its own `Date.now()`
 * directly.
 *
 * Ticks four times a second: the display is whole seconds, and forty phones re-rendering
 * ten times a second to show the same number is waste.
 */
export function useCountdown(deadlineAt: number | null, skewMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadlineAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadlineAt]);

  if (deadlineAt === null) return 0;
  return Math.max(0, deadlineAt - (now + skewMs));
}
