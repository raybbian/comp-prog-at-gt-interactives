import logoUrl from '../assets/logo.png';
import { formatDuration } from '../format';
import type { LeaderboardEntry } from '../leaderboard/store';
import { AttractScreen } from './AttractScreen';
import { Leaderboard } from './Leaderboard';
import { MicroLabel } from './MicroLabel';
import { Rule } from './Rule';

export type BoothAttractProps = {
  mark: string;
  title: string;
  /** One plain sentence: the rule of the game, nothing else. */
  tagline: string;
  entries: LeaderboardEntry[];
  emptyLabel: string;
  /** Defaults suit a board ranked on time; override to rank on anything else. */
  boardHeading?: string;
  valueLabel?: string;
  format?: (value: number) => string;
  onDismiss: () => void;
};

/**
 * Rules and board sit side by side rather than rotating through each other: a
 * visitor glancing over from a few feet away gets one stable thing to read, and
 * nothing on the screen moves except the prompt at the bottom.
 */
export function BoothAttract({
  mark,
  title,
  tagline,
  entries,
  emptyLabel,
  boardHeading = 'Fastest wins',
  valueLabel = 'Time',
  format = formatDuration,
  onDismiss,
}: BoothAttractProps) {
  return (
    <AttractScreen onDismiss={onDismiss}>
      <div className="grid gap-12 md:grid-cols-[1fr_auto] md:gap-24">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="" aria-hidden="true" className="size-8 shrink-0" />
            <MicroLabel as="div">{mark}</MicroLabel>
          </div>
          <h1 className="text-8xl font-semibold tracking-[-0.03em] text-ink">{title}</h1>
          <Rule className="max-w-xs" />
          <p className="max-w-sm text-lg leading-relaxed text-ink">{tagline}</p>
        </div>

        <div className="flex min-w-80 flex-col gap-4">
          <MicroLabel as="h2">{boardHeading}</MicroLabel>
          <Leaderboard
            entries={entries}
            format={format}
            valueLabel={valueLabel}
            limit={10}
            emptyLabel={emptyLabel}
          />
        </div>
      </div>
    </AttractScreen>
  );
}
