import { cn } from '@cpatgt/shared';

export type StoneState = 'live' | 'staged' | 'hinted' | 'gone';

export type StoneProps = {
  state: StoneState;
  label: string;
  interactive: boolean;
  /** Staggers the bot's take so it reads as one gesture rather than a blink. */
  delayMs?: number;
  onPreview?: () => void;
  onSelect?: () => void;
};

const VISUALS: Record<StoneState, string> = {
  live: 'bg-ink border-ink',
  staged: 'bg-accent border-accent',
  hinted: 'bg-ground border-accent border-2',
  // Taken stones stay as faint outlines: the row never reflows, and you can still
  // read how far the game has come without counting what is missing.
  gone: 'bg-transparent border-hairline-strong scale-[0.4]',
};

export function Stone({
  state,
  label,
  interactive,
  delayMs = 0,
  onPreview,
  onSelect,
}: StoneProps) {
  const isGone = state === 'gone';
  const clickable = interactive && !isGone;

  return (
    <button
      type="button"
      aria-label={label}
      aria-hidden={isGone}
      disabled={!clickable}
      tabIndex={-1}
      onPointerEnter={clickable ? onPreview : undefined}
      onClick={clickable ? onSelect : undefined}
      className={cn(
        'grid size-14 shrink-0 place-items-center',
        clickable ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <span
        style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
        className={cn(
          'block size-10 rounded-full border transition-[background-color,border-color,transform]',
          'duration-[var(--duration-settle)] ease-quart',
          VISUALS[state],
        )}
      />
    </button>
  );
}
