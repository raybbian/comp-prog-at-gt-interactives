import { cn } from '@cpatgt/shared';

export type HitPadProps = {
  m: number;
  /** The bot's last hit, which the visitor may not repeat. 0 when nothing is forbidden. */
  forbidden: number;
  staged: number | null;
  disabled: boolean;
  onTap: (hit: number) => void;
  onPreview: (hit: number | null) => void;
};

/**
 * One key per amount, 1 to m, five across. Keys are `h-14`, comfortably past the
 * forty-four pixel floor and reachable one-handed at the bottom of the screen. The
 * forbidden amount stays on the pad, struck through, so the rule is visible rather
 * than a key that silently went missing. The staged key is the one ochre thing on the
 * screen: this phone's own pending action.
 */
export function HitPad({ m, forbidden, staged, disabled, onTap, onPreview }: HitPadProps) {
  const columns = Math.min(m, 5);
  return (
    <div
      role="group"
      aria-label="Damage"
      onPointerLeave={() => onPreview(null)}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: m }, (_, i) => i + 1).map((hit) => {
        const isForbidden = hit === forbidden;
        const isStaged = hit === staged;
        return (
          <button
            key={hit}
            type="button"
            aria-label={isForbidden ? `${hit}, not allowed` : `Hit ${hit}`}
            aria-pressed={isStaged}
            disabled={disabled || isForbidden}
            onPointerEnter={() => onPreview(hit)}
            onClick={() => onTap(hit)}
            className={cn(
              'flex h-14 items-center justify-center border font-mono text-lg tnum',
              'transition-[background-color,border-color,color] duration-[var(--duration-quick)] ease-quart',
              'disabled:pointer-events-none',
              isForbidden
                ? 'border-hairline text-ink-faint line-through'
                : isStaged
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-hairline-strong bg-ground-raised text-ink active:bg-ground-sunken disabled:opacity-35',
            )}
          >
            {hit}
          </button>
        );
      })}
    </div>
  );
}
