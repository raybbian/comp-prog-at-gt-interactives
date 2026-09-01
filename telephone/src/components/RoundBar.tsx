import { MicroLabel, cn } from '@cpatgt/shared';
import { formatClock } from '../format.ts';
import type { Health } from '../state/useMeeting.ts';
import type { PublicRound } from '../protocol/types.ts';

/**
 * The top rail on both phones: which round, how long is left, and what it has cost.
 *
 * The connection dot is small and always present. At a live event a volunteer needs
 * something to point at when a team says "it's broken", and "amber means it is polling
 * instead of streaming, the game is fine" is a much better conversation than a blank
 * shrug. It is never ochre — the accent means the player's own pending action, and a
 * network state is not that.
 */
export function RoundBar({
  round,
  msLeft,
  sent,
  received,
  health,
}: {
  round: PublicRound | null;
  msLeft: number;
  sent: number;
  received: number;
  health: Health;
}) {
  const phaseLabel =
    round === null
      ? 'Waiting'
      : round.phase === 'brief'
        ? 'Agree on a protocol'
        : round.phase === 'play'
          ? `Round ${round.index}`
          : round.phase === 'reveal'
            ? 'Answer'
            : 'Waiting';

  return (
    <div className="flex items-center gap-4">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-1.5 rounded-full',
            health === 'live'
              ? 'bg-ink-faint'
              : health === 'polling'
                ? 'bg-ink-muted'
                : health === 'revoked'
                  ? 'bg-ink'
                  : 'bg-hairline-strong',
          )}
        />
        <span className="font-mono text-xs tnum text-ink-muted">
          &#8593;{sent} &#8595;{received}
        </span>
      </span>

      <MicroLabel className="hidden text-ink sm:inline">{phaseLabel}</MicroLabel>

      <span
        className={cn(
          'font-mono text-base tnum',
          msLeft > 0 && msLeft <= 60_000 ? 'text-accent' : 'text-ink',
        )}
      >
        {formatClock(msLeft)}
      </span>
    </div>
  );
}
