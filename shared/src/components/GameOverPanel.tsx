import { useState, type FormEvent, type ReactNode } from 'react';
import { formatDuration } from '../format';
import { checkName, MAX_NAME_LENGTH, normalizeName } from '../leaderboard/name';
import type { LeaderboardEntry, SubmittedRun } from '../leaderboard/store';
import { Button } from './Button';
import { Leaderboard } from './Leaderboard';
import { MicroLabel } from './MicroLabel';

export type GameOverPanelProps = {
  /** The verdict, in the interactive's own words: 'You win', 'Bot wins'. */
  headline: string;
  won: boolean;
  elapsedMs: number;
  /** One line of aftermath, e.g. which bucket it turned out to be. */
  note?: ReactNode;
  /** Only interactives that offer a hint need this. */
  hintUsed?: boolean;
  submitted: SubmittedRun | null;
  entries: LeaderboardEntry[];
  /** Defaults suit a board ranked on time; override to rank on anything else. */
  boardHeading?: string;
  valueLabel?: string;
  format?: (value: number) => string;
  onSubmitName: (name: string) => void;
  onPlayAgain: () => void;
};

function NameEntry({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const result = checkName(value);
    if (!result.ok) {
      setError(result.reason === 'empty' ? 'Enter a name.' : 'Pick a different name.');
      return;
    }
    onSubmit(result.name);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-stretch gap-3">
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(normalizeName(e.target.value));
            setError(null);
          }}
          maxLength={MAX_NAME_LENGTH}
          placeholder="YOUR NAME"
          aria-label="Your name"
          spellCheck={false}
          autoComplete="off"
          className="h-14 w-56 border border-hairline-strong bg-ground-raised px-4 font-mono
            text-lg tracking-[0.08em] text-ink outline-none placeholder:text-ink-faint
            focus-visible:border-accent"
        />
        <Button type="submit" variant="primary" size="lg">
          Submit
        </Button>
      </div>
      {error !== null && <p className="text-sm text-accent">{error}</p>}
    </form>
  );
}

/** End screen for every interactive: verdict, name entry on an eligible win, board. */
export function GameOverPanel({
  headline,
  won,
  elapsedMs,
  note,
  hintUsed = false,
  submitted,
  entries,
  boardHeading = 'Fastest wins',
  valueLabel = 'Time',
  format = formatDuration,
  onSubmitName,
  onPlayAgain,
}: GameOverPanelProps) {
  const eligible = won && !hintUsed;

  return (
    <div className="flex animate-rise-in flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <h2 className="text-4xl font-semibold tracking-[-0.02em] text-ink">{headline}</h2>
          {won && (
            <span className="font-mono text-2xl tnum text-ink-muted">
              {formatDuration(elapsedMs)}
            </span>
          )}
        </div>
        {note !== undefined && note !== null && (
          <p className="text-sm text-ink-muted">{note}</p>
        )}
      </div>

      {eligible && submitted === null && <NameEntry onSubmit={onSubmitName} />}

      {won && hintUsed && (
        <p className="text-sm text-ink-muted">Hint used. This one doesn't count.</p>
      )}

      {submitted !== null && (
        <MicroLabel as="div" className="text-accent">
          Rank {submitted.rank} of {submitted.total}
        </MicroLabel>
      )}

      {(submitted !== null || !eligible) && entries.length > 0 && (
        <div className="flex flex-col gap-3">
          <MicroLabel as="h3">{boardHeading}</MicroLabel>
          <Leaderboard
            entries={entries}
            format={format}
            valueLabel={valueLabel}
            limit={5}
            {...(submitted !== null ? { highlightAt: submitted.at } : {})}
          />
        </div>
      )}

      <div>
        <Button variant="quiet" size="lg" onClick={onPlayAgain}>
          Play again
        </Button>
      </div>
    </div>
  );
}
