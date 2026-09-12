import { MicroLabel, cn } from '@cpatgt/shared';
import { formatClock } from '../format.ts';
import type { PublicQuestion, StandingRow } from '../protocol/types.ts';
import type { Health } from '../state/useMeeting.ts';

/**
 * The top rail on a phone: which question, how long is left, and where the team stands.
 *
 * The rank is here rather than buried on a board screen because it is the answer to the
 * question a team actually has at minute two — "are we behind?" — and it is one glyph wide.
 *
 * The connection dot is small and always present. At a live event a volunteer needs
 * something to point at when a team says "it's broken", and "amber means it is polling
 * instead of streaming, the game is fine" is a much better conversation than a blank shrug.
 * It is never ochre — the accent means the player's own pending action, and a network state
 * is not that.
 */
export function QuestionBar({
  question,
  msLeft,
  standing,
  health,
}: {
  question: PublicQuestion | null;
  msLeft: number;
  standing: StandingRow | null;
  health: Health;
}) {
  const phase = question?.phase ?? 'lobby';
  const label =
    question === null
      ? 'Waiting'
      : phase === 'play'
        ? `${question.index + 1} of ${question.total}`
        : phase === 'grading'
          ? 'Marking'
          : phase === 'reveal'
            ? 'Answer'
            : 'Waiting';

  return (
    <div className="flex items-center gap-4">
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

      {standing !== null && (
        <span className="font-mono text-xs tnum text-ink-muted">
          #{standing.rank} · {standing.points}
        </span>
      )}

      <MicroLabel className="hidden text-ink sm:inline">{label}</MicroLabel>

      {phase === 'play' && (
        <span
          className={cn(
            'font-mono text-base tnum',
            msLeft > 0 && msLeft <= 30_000 ? 'text-accent' : 'text-ink',
          )}
        >
          {formatClock(msLeft)}
        </span>
      )}
    </div>
  );
}
