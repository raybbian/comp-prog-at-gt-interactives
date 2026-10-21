import { MicroLabel } from '@cpatgt/shared';
import type { Hit } from '../game/state';

export type HealthBarProps = {
  opening: number;
  health: number;
  lastHit: Hit | null;
};

/**
 * The health as a number and as one continuous bar.
 *
 * Deliberately not a row of units: any fixed row width would draw a modulus on the
 * screen, and spotting the right modulus is most of the game. The chunk the last hit
 * took is left as a faint sliver so a hit reads as a hit rather than a number changing.
 */
export function HealthBar({ opening, health, lastHit }: HealthBarProps) {
  const shown = Math.max(0, health);
  const remaining = (shown / opening) * 100;
  const taken = lastHit === null ? 0 : (Math.min(lastHit.hit, opening - shown) / opening) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <MicroLabel>Health</MicroLabel>
        <MicroLabel>of {opening}</MicroLabel>
      </div>
      <div className="font-mono text-6xl font-medium tnum text-ink">{shown}</div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={opening}
        aria-valuenow={shown}
        className="flex h-3 w-full overflow-hidden border border-hairline-strong bg-ground-sunken"
      >
        <div
          className="h-full bg-ink transition-[width] duration-[var(--duration-settle)] ease-quart"
          style={{ width: `${remaining}%` }}
        />
        <div
          className="h-full bg-hairline-strong transition-[width] duration-[var(--duration-settle)] ease-quart"
          style={{ width: `${taken}%` }}
        />
      </div>
    </div>
  );
}
