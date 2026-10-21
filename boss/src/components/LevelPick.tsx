import { Button, Rule } from '@cpatgt/shared';
import { LEVEL_LABELS, LEVELS, type Level } from '../game/levels';

export type LevelPickProps = {
  onPick: (level: Level) => void;
};

/**
 * The first screen. Three levels and the rules in two lines; nothing here says what
 * makes one level harder than another, because working that out is the game.
 */
export function LevelPick({ onPick }: LevelPickProps) {
  return (
    <div className="flex animate-rise-in flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink">Boss Fight</h1>
        <p className="text-sm text-ink-muted">
          Take turns hitting the boss. You cannot repeat the hit the bot just made. Whoever
          lands the finishing blow wins.
        </p>
      </div>
      <Rule />
      <div className="flex flex-col gap-3">
        {LEVELS.map((level) => (
          <Button
            key={level}
            variant="quiet"
            size="lg"
            className="w-full"
            onClick={() => onPick(level)}
          >
            {LEVEL_LABELS[level]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-ink-faint">
        Every game can be won. The bot never makes a mistake.
      </p>
    </div>
  );
}
