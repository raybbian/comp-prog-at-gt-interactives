import { Button, MicroLabel, cn } from '@cpatgt/shared';

/**
 * The snake laid out flat, in the order you walk it.
 *
 * On the round where the shape is already known, hunting a twenty-three pixel cell in a
 * two-dimensional grid is the wrong way to enter sixty colours on a phone. This is the
 * right way: a ribbon in path order with a cursor, so decoding is "advance, press plus or
 * minus" — which is also the shape of the message being decoded. The physical act of
 * filling it in matches the structure of what was sent.
 */

const LEVEL_CLASS = [
  '',
  'bg-snake-1',
  'bg-snake-2',
  'bg-snake-3',
  'bg-snake-4',
  'bg-snake-5',
  'bg-snake-6',
  'bg-snake-7',
  'bg-snake-8',
  'bg-snake-9',
] as const;

export function PathStrip({
  levels,
  cursor,
  levelCount,
  onCursor,
  onBump,
  onSet,
}: {
  levels: readonly number[];
  cursor: number;
  levelCount: number;
  onCursor: (index: number) => void;
  onBump: (index: number, delta: number) => void;
  onSet: (index: number, level: number) => void;
}) {
  const current = levels[cursor] ?? 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <MicroLabel as="h2">Along the snake</MicroLabel>
        <span className="font-mono text-xs tnum text-ink-faint">
          {cursor + 1}/{levels.length}
        </span>
      </div>

      <div className="grid grid-cols-10 gap-px">
        {levels.map((level, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onCursor(i)}
            aria-label={`Cell ${i + 1}`}
            className={cn(
              'relative flex aspect-square items-center justify-center font-mono text-[0.625rem] leading-none tnum text-accent-ink',
              LEVEL_CLASS[level] ?? 'bg-ground-sunken',
              i === cursor && 'ring-2 ring-accent ring-inset',
            )}
          >
            {level >= 1 ? level : ''}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="quiet" onClick={() => onCursor(Math.max(0, cursor - 1))}>
          Prev
        </Button>
        <Button variant="quiet" onClick={() => onBump(cursor, -1)}>
          &minus;
        </Button>
        <span
          className={cn(
            'flex h-10 w-12 items-center justify-center font-mono text-lg tnum text-accent-ink',
            LEVEL_CLASS[current],
          )}
        >
          {current}
        </span>
        <Button variant="quiet" onClick={() => onBump(cursor, 1)}>
          +
        </Button>
        <Button
          variant="quiet"
          onClick={() => onCursor(Math.min(levels.length - 1, cursor + 1))}
        >
          Next
        </Button>
      </div>

      {/* Typing a level outright, for a team whose protocol sends them absolutely. */}
      <div className="grid grid-cols-9 gap-px">
        {Array.from({ length: levelCount }, (_, i) => i + 1).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => {
              onSet(cursor, level);
              onCursor(Math.min(levels.length - 1, cursor + 1));
            }}
            className={cn(
              'flex h-11 items-center justify-center font-mono text-sm tnum text-accent-ink',
              LEVEL_CLASS[level],
            )}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}
