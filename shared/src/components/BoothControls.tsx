import { cn } from '../cn';
import { formatDuration } from '../format';
import { Button } from './Button';

export type BoothControlsProps = {
  elapsedMs: number;
  /** Dims the clock until the visitor's first move actually starts it. */
  running: boolean;
  onHelp: () => void;
  onBack: () => void;
};

/** Fills `AppShell`'s trailing slot. Every interactive gets the same three. */
export function BoothControls({ elapsedMs, running, onHelp, onBack }: BoothControlsProps) {
  return (
    <>
      <span
        className={cn(
          'font-mono text-sm tnum',
          running ? 'text-ink-muted' : 'text-ink-faint',
        )}
      >
        {formatDuration(elapsedMs)}
      </span>
      <Button variant="ghost" onClick={onHelp}>
        Help
      </Button>
      {/*
        Negative margin so the label sits on the rail's padding line while the
        button keeps a full-size hit area around it.
      */}
      <Button variant="ghost" className="-mr-4" onClick={onBack}>
        Back
      </Button>
    </>
  );
}
