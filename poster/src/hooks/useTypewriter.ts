import { useEffect, useState } from 'react';

const HOLD_MS = 7000;
const ERASE_MS = 22;
const PAUSE_MS = 650;
const TYPE_MS = 52;

/**
 * Number of characters of `text` to show, cycling type → hold → erase → repeat.
 *
 * Starts complete and stays complete until the first hold elapses, so the command
 * line reads properly on the first frame and whenever motion is turned off — an
 * unattended screen should never be caught mid-word by someone walking past.
 */
export function useTypewriter(text: string, enabled: boolean): number {
  const [count, setCount] = useState(text.length);

  useEffect(() => {
    if (!enabled) {
      setCount(text.length);
      return;
    }

    let erasing = true;
    let shown = text.length;
    let timer = 0;

    // The hold and the beat before retyping are folded into the delay that follows
    // a completed pass, which is why there are two phases here rather than four.
    const advance = (): void => {
      if (erasing) {
        shown -= 1;
        setCount(shown);
        timer = window.setTimeout(advance, shown === 0 ? PAUSE_MS : ERASE_MS);
        if (shown === 0) erasing = false;
        return;
      }

      shown += 1;
      setCount(shown);
      const done = shown === text.length;
      if (done) erasing = true;
      timer = window.setTimeout(advance, done ? HOLD_MS : TYPE_MS);
    };

    timer = window.setTimeout(advance, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [text, enabled]);

  return count;
}
