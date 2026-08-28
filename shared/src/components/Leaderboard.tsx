import { cn } from '../cn';
import type { LeaderboardEntry } from '../leaderboard/store';
import { MicroLabel } from './MicroLabel';

export type LeaderboardProps = {
  /** Already sorted — the store owns ordering. */
  entries: LeaderboardEntry[];
  format: (value: number) => string;
  valueLabel: string;
  limit?: number;
  /** `at` timestamp of the row to highlight, i.e. the run just submitted. */
  highlightAt?: number;
  emptyLabel?: string;
  className?: string;
};

export function Leaderboard({
  entries,
  format,
  valueLabel,
  limit = 10,
  highlightAt,
  emptyLabel = 'No entries yet.',
  className,
}: LeaderboardProps) {
  const shown = entries.slice(0, limit);

  if (shown.length === 0) {
    return <p className={cn('py-6 text-sm text-ink-faint', className)}>{emptyLabel}</p>;
  }

  return (
    <table
      className={cn(
        '-mx-3 w-[calc(100%+1.5rem)] border-collapse text-left',
        className,
      )}
    >
      <thead>
        <tr className="border-b border-hairline">
          <th className="w-12 pb-2 pl-3 font-normal">
            <MicroLabel as="span">#</MicroLabel>
          </th>
          <th className="pb-2 font-normal">
            <MicroLabel as="span">Name</MicroLabel>
          </th>
          <th className="pb-2 pr-3 text-right font-normal">
            <MicroLabel as="span">{valueLabel}</MicroLabel>
          </th>
        </tr>
      </thead>
      <tbody>
        {shown.map((entry, i) => {
          const isHighlighted = highlightAt !== undefined && entry.at === highlightAt;
          return (
            <tr
              key={`${entry.at}-${entry.name}`}
              className={cn(
                'border-b border-hairline last:border-b-0',
                isHighlighted && 'bg-accent-soft',
              )}
            >
              <td
                className={cn(
                  'py-2.5 pl-3 font-mono text-sm tnum',
                  isHighlighted ? 'text-accent' : 'text-ink-faint',
                )}
              >
                {i + 1}
              </td>
              <td className="py-2.5 pr-4 text-sm text-ink">{entry.name}</td>
              <td className="py-2.5 pr-3 text-right font-mono text-sm tnum text-ink">
                {format(entry.value)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
