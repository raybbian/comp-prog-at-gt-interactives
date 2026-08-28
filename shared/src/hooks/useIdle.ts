import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
] as const;

export type UseIdleOptions = {
  delayMs: number;
  onIdle: () => void;
  enabled?: boolean;
};

/**
 * Calls `onIdle` after `delayMs` without user input. Unattended booth screens need
 * this to hand themselves back to the next visitor; nothing else resets the board.
 *
 * `onIdle` is held in a ref so a caller passing an inline arrow does not tear down
 * and re-arm the timer on every render, which would mean it never fires.
 */
export function useIdle({ delayMs, onIdle, enabled = true }: UseIdleOptions): void {
  const callback = useRef(onIdle);
  callback.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    let timer = 0;
    const arm = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), delayMs);
    };

    arm();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, arm, { passive: true });
    }

    return () => {
      window.clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, arm);
      }
    };
  }, [delayMs, enabled]);
}
