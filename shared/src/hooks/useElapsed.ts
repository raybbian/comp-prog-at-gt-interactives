import { useEffect, useState } from 'react';

/**
 * Milliseconds on the clock: zero until the game starts, ticking while it runs,
 * frozen at the finish. Tenths are the smallest thing shown, so 100ms is as often
 * as this needs to re-render.
 */
export function useElapsed(startedAt: number | null, finishedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);

  return startedAt === null ? 0 : (finishedAt ?? now) - startedAt;
}
