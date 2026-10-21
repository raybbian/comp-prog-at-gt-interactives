import { Button, formatDuration, MicroLabel } from '@cpatgt/shared';
import type { Hit } from '../game/state';

export type VerdictProps = {
  won: boolean;
  history: readonly Hit[];
  elapsedMs: number;
  onPlayAgain: () => void;
  onChangeLevel: () => void;
};

/**
 * The end of a game. There is no board and no name entry: this is played on a phone in
 * a room, and the point is to go again and get it, not to rank.
 */
export function Verdict({ won, history, elapsedMs, onPlayAgain, onChangeLevel }: VerdictProps) {
  const last = history[history.length - 1];
  const yourHits = history.filter((h) => h.by === 'you').length;

  return (
    <div className="flex animate-rise-in flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <h2 className="text-4xl font-semibold tracking-[-0.02em] text-ink">
            {won ? 'You win' : 'Bot wins'}
          </h2>
          <span className="font-mono text-2xl tnum text-ink-muted">
            {formatDuration(elapsedMs)}
          </span>
        </div>
        {last !== undefined && (
          <p className="text-sm text-ink-muted">
            {won
              ? `Your hit of ${last.hit} finished it, in ${yourHits} ${yourHits === 1 ? 'hit' : 'hits'}.`
              : `The bot finished it with a hit of ${last.hit}. There was a better hit somewhere.`}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <MicroLabel as="h3">Hits</MicroLabel>
        <ol className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm tnum text-ink-muted">
          {history.map((h, i) => (
            <li key={i} className={h.by === 'you' ? 'text-ink' : undefined}>
              {h.by === 'you' ? 'you' : 'bot'} {h.hit}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex gap-3">
        <Button variant="primary" size="lg" onClick={onPlayAgain}>
          Play again
        </Button>
        <Button variant="quiet" size="lg" onClick={onChangeLevel}>
          Change level
        </Button>
      </div>
    </div>
  );
}
