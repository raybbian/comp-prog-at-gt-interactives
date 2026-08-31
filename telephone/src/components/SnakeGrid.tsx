import { cn } from '@cpatgt/shared';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Size } from '../protocol/grid.ts';
import { EMPTY, colOf, rowOf } from '../protocol/grid.ts';

/**
 * One renderer for every grid in the game: the picture the sender is holding, the canvas
 * the receiver paints on, the samples on the briefing screen, and the answer at the
 * reveal.
 *
 * Deliberately one component rather than two. When the sender says "row three", both
 * halves of the team have to be looking at the same thing down to the pixel, and two
 * implementations would drift.
 */

/** The nine ramp levels, as Tailwind classes so the build can see them. */
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

export type SnakeGridProps = {
  size: Size;
  grid: string;
  /** 1 for the monochrome rounds, where the body is ink rather than a ramp colour. */
  levels: number;
  /** Row and column indices down the edges. Nobody should count cells with a fingertip. */
  rails?: boolean | undefined;
  /** Cells that differ from the answer, shown only after the round is over. */
  wrong?: readonly number[] | undefined;
  /** The answer, drawn as a hairline outline behind the drawing at the reveal. */
  ghost?: string | null | undefined;
  /** Marks the first cell of the snake, so "the head" means one thing to both players. */
  head?: number | null | undefined;
  onCellDown?: ((cell: number) => void) | undefined;
  onCellEnter?: ((cell: number) => void) | undefined;
  onPointerUp?: (() => void) | undefined;
  className?: string | undefined;
};

export function SnakeGrid({
  size,
  grid,
  levels,
  rails = false,
  wrong,
  ghost,
  head,
  onCellDown,
  onCellEnter,
  onPointerUp,
  className,
}: SnakeGridProps) {
  const interactive = onCellDown !== undefined;
  const wrongSet = wrong === undefined ? null : new Set(wrong);

  const down = (cell: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (onCellDown === undefined) return;
    // Touch implicitly captures the pointer on the element it started on, which would
    // stop every other cell from ever seeing the drag. Milk's grid does the same thing.
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onCellDown(cell);
  };

  return (
    <div className={cn('flex w-full flex-col', className)}>
      {rails && (
        <div className="flex pl-[2ch]">
          {Array.from({ length: size.w }, (_, c) => (
            <div
              key={c}
              className="flex-1 pb-1 text-center font-mono text-[0.5rem] tnum text-ink-faint"
            >
              {c % 10}
            </div>
          ))}
        </div>
      )}

      <div className="flex">
        {rails && (
          <div className="flex w-[2ch] flex-col">
            {Array.from({ length: size.h }, (_, r) => (
              <div
                key={r}
                className="flex flex-1 items-center justify-center pr-1 font-mono text-[0.5rem] tnum text-ink-faint"
              >
                {r % 10}
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'grid flex-1 gap-px border border-hairline-strong bg-hairline',
            interactive && 'touch-none select-none',
          )}
          style={{
            gridTemplateColumns: `repeat(${size.w}, minmax(0, 1fr))`,
            aspectRatio: `${size.w} / ${size.h}`,
          }}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {Array.from({ length: size.w * size.h }, (_, cell) => {
            const value = grid[cell] ?? EMPTY;
            const level = Number(value);
            const filled = value !== EMPTY;
            const inGhost = ghost !== null && ghost !== undefined && ghost[cell] !== EMPTY;

            return (
              <div
                key={cell}
                aria-hidden="true"
                onPointerDown={interactive ? down(cell) : undefined}
                onPointerEnter={onCellEnter === undefined ? undefined : () => onCellEnter(cell)}
                className={cn(
                  'relative',
                  // Every fifth line heavier, like graph paper: it is what makes a cell
                  // countable at a glance instead of one at a time.
                  (colOf(size, cell) + 1) % 5 === 0 &&
                    colOf(size, cell) !== size.w - 1 &&
                    'border-r border-hairline-strong',
                  (rowOf(size, cell) + 1) % 5 === 0 &&
                    rowOf(size, cell) !== size.h - 1 &&
                    'border-b border-hairline-strong',
                  filled
                    ? levels > 1
                      ? LEVEL_CLASS[level]
                      : 'bg-ink'
                    : inGhost
                      ? 'bg-ground-sunken'
                      : 'bg-ground-raised',
                )}
              >
                {inGhost && !filled && (
                  <span className="absolute inset-1 border border-dashed border-ink-faint" />
                )}
                {wrongSet?.has(cell) === true && (
                  <span className="absolute inset-0 border-2 border-accent" />
                )}
                {head === cell && (
                  <span className="absolute inset-[30%] rounded-full bg-ground-raised" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
