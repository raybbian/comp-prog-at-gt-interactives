import { MicroLabel, cn } from '@cpatgt/shared';
import type { StandingRow } from '../protocol/types.ts';

/**
 * The board.
 *
 * It is on the projector at every moment of the meeting, including the lobby and including
 * while a question is being read. That is the one piece of staging this game does not
 * negotiate: teams are about to carry these points into a Codeforces contest, and a score
 * you only see between questions is a score you cannot play towards. During a question it
 * is the last question's board, which is exactly the information a team needs to decide
 * whether to spend their remaining minute on a third bug or on the complexity.
 *
 * Two sizes, one component, because the board on a phone and the board on the projector
 * must never disagree about the order — and they would, eventually, if they were two
 * pieces of code reading the same rows.
 */

export type StandingsSize = 'phone' | 'room';

export function Standings({
  rows,
  size = 'phone',
  highlightTeamId,
  limit,
  className,
}: {
  rows: readonly StandingRow[];
  size?: StandingsSize;
  /** The reader's own team, kept legible when everything else recedes. */
  highlightTeamId?: string | undefined;
  limit?: number;
  className?: string;
}) {
  const room = size === 'room';
  const shown = limit === undefined ? rows : rows.slice(0, limit);

  if (shown.length === 0) {
    return (
      <p className={cn(room ? 'py-8 text-[1.75rem]' : 'py-4 text-sm', 'text-ink-faint', className)}>
        Nobody has joined yet.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <ol className="flex flex-col">
        {shown.map((row) => {
          const mine = row.teamId === highlightTeamId;
          return (
            <li
              key={row.teamId}
              className={cn(
                'flex items-baseline border-b border-hairline',
                room ? 'h-[62px] gap-5' : 'gap-3 py-2',
              )}
            >
              <span
                className={cn(
                  'shrink-0 text-right font-mono tnum text-ink-faint',
                  room ? 'w-9 text-[1.75rem]' : 'w-5 text-xs',
                )}
              >
                {row.rank}
              </span>
              <span
                className={cn(
                  'flex-1 truncate',
                  room ? 'text-[2rem]' : 'text-sm',
                  mine ? 'text-ink' : room ? 'text-ink' : 'text-ink-muted',
                  mine && 'font-medium',
                )}
              >
                {row.name}
              </span>
              {/* Complexities and bugs, small, because they explain the points without
                  competing with them. A team reads the total; a team that has just lost a
                  place reads the two columns to find out why. */}
              <span
                className={cn(
                  'shrink-0 text-right font-mono tnum text-ink-faint',
                  room ? 'w-28 text-[1.5rem]' : 'w-12 text-xs',
                )}
              >
                {row.complexities}·{row.bugs}
              </span>
              <span
                className={cn(
                  'shrink-0 text-right font-mono tnum text-ink',
                  room ? 'w-28 text-[2rem]' : 'w-12 text-sm',
                )}
              >
                {row.points}
              </span>
            </li>
          );
        })}
      </ol>

      <div className={cn('flex justify-end', room ? 'mt-3 gap-5' : 'mt-1.5 gap-3')}>
        <MicroLabel size={room ? 'lg' : 'sm'} className={room ? 'w-28 text-right' : 'w-12 text-right'}>
          O·bugs
        </MicroLabel>
        <MicroLabel size={room ? 'lg' : 'sm'} className={room ? 'w-28 text-right' : 'w-12 text-right'}>
          Points
        </MicroLabel>
      </div>
    </div>
  );
}
