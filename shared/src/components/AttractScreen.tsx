import { useEffect, useRef, type ReactNode } from 'react';
import { MicroLabel } from './MicroLabel';

const DISMISS_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export type AttractScreenProps = {
  onDismiss: () => void;
  hint?: string;
  children: ReactNode;
};

/**
 * Full-bleed idle screen for an unattended booth. Any input at all dismisses it, so a
 * visitor never has to work out what to click before the thing will let them play.
 */
export function AttractScreen({
  onDismiss,
  hint = 'Press any key to play',
  children,
}: AttractScreenProps) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    const handle = (): void => dismiss.current();
    for (const event of DISMISS_EVENTS) {
      window.addEventListener(event, handle, { passive: true });
    }
    return () => {
      for (const event of DISMISS_EVENTS) {
        window.removeEventListener(event, handle);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-ground">
      <div className="flex flex-1 items-center justify-center px-6 py-12 md:px-10">
        <div className="w-full max-w-5xl">{children}</div>
      </div>
      <div className="flex h-16 shrink-0 items-center justify-center border-t border-hairline">
        <MicroLabel className="animate-[pulse-label_3s_ease-in-out_infinite]">
          {hint}
        </MicroLabel>
      </div>
    </div>
  );
}
