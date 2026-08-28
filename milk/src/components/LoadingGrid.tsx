import { cn, MicroLabel } from '@cpatgt/shared';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  allBuckets,
  bucketLabel,
  isIn,
  kitRange,
  kitSize,
  resultOf,
  type Loading,
} from '../game/buckets';

export type LoadingGridProps = {
  loading: Loading;
  kitCount: number;
  /** The five results as a bitmask, or null before the kits have run. */
  pattern: number | null;
  /** How many kit results have landed so far. */
  revealed: number;
  locked: boolean;
  selection: number | null;
  cursor: { bucket: number; kit: number } | null;
  onLoad: (bucket: number, kit: number, on: boolean) => void;
  onSelect: (bucket: number) => void;
};

/**
 * The whole game on one grid: buckets across, kits down, a filled cell meaning that
 * bucket's milk goes into that kit. Everything is committed before any kit answers,
 * so the results column stays empty until the end and then fills in.
 */
export function LoadingGrid({
  loading,
  kitCount,
  pattern,
  revealed,
  locked,
  selection,
  cursor,
  onLoad,
  onSelect,
}: LoadingGridProps) {
  // Whether the drag underway is filling cells or clearing them. Decided once, on
  // the cell it started from, so crossing a row cannot flip-flop.
  const drag = useRef<boolean | null>(null);

  useEffect(() => {
    const end = (): void => {
      drag.current = null;
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  const naming = locked && pattern !== null;

  return (
    <div className="-mx-1 overflow-x-auto">
      <div
        role="grid"
        className="grid min-w-[34rem] touch-none grid-cols-[2.5rem_repeat(20,minmax(0,1fr))_6.5rem] items-center gap-x-px gap-y-1 px-1"
      >
        <MicroLabel className="pr-2 pb-2 text-right">Kit</MicroLabel>
        {allBuckets().map((bucket) => {
          const selected = selection === bucket;
          return (
            <button
              key={bucket}
              type="button"
              role="columnheader"
              aria-label={`Bucket ${bucketLabel(bucket)}`}
              aria-pressed={selected}
              disabled={!naming}
              tabIndex={-1}
              onClick={() => onSelect(bucket)}
              className={cn(
                'mb-1 py-1 font-mono text-[0.6875rem] tnum transition-colors',
                'duration-[var(--duration-quick)] ease-quart',
                naming && 'cursor-pointer',
                selected
                  ? 'bg-accent font-semibold text-accent-ink'
                  : cn('text-ink-muted', naming && 'hover:bg-ground-sunken hover:text-ink'),
              )}
            >
              {bucketLabel(bucket)}
            </button>
          );
        })}
        <MicroLabel className="pb-2 pl-3">Result</MicroLabel>

        {kitRange(kitCount).map((kit) => {
          const size = kitSize(loading, kit);
          const known = pattern !== null && kit < revealed;
          const contaminated = known && resultOf(pattern, kit);

          return (
            <Row key={kit}>
              <MicroLabel className="pr-2 text-right">{kit + 1}</MicroLabel>

              {allBuckets().map((bucket) => {
                const on = isIn(loading, bucket, kit);
                const isCursor =
                  cursor !== null && cursor.bucket === bucket && cursor.kit === kit;
                // Checking a bucket against the results means tracing its column by
                // eye, so the whole column lights up rather than just its heading.
                const inColumn = selection === bucket;

                return (
                  <button
                    key={bucket}
                    type="button"
                    role="gridcell"
                    aria-label={`Bucket ${bucketLabel(bucket)} into kit ${kit + 1}`}
                    aria-pressed={on}
                    disabled={locked}
                    tabIndex={-1}
                    onPointerDown={
                      locked
                        ? undefined
                        : (event) => {
                            // Touch puts an implicit pointer capture on the cell the
                            // finger landed on, which would stop every other cell
                            // seeing the drag.
                            event.currentTarget.releasePointerCapture?.(event.pointerId);
                            drag.current = !on;
                            onLoad(bucket, kit, !on);
                          }
                    }
                    onPointerEnter={
                      locked
                        ? undefined
                        : () => {
                            if (drag.current !== null) onLoad(bucket, kit, drag.current);
                          }
                    }
                    className={cn(
                      'h-8 w-full border transition-colors',
                      'duration-[var(--duration-quick)] ease-quart',
                      locked ? 'cursor-default' : 'cursor-pointer',
                      on
                        ? cn('bg-ink', inColumn ? 'border-accent' : 'border-ink')
                        : cn(
                            inColumn
                              ? 'border-accent bg-accent-soft'
                              : 'border-hairline bg-transparent',
                            !locked && 'hover:border-hairline-strong hover:bg-ground-sunken',
                          ),
                      isCursor && 'ring-1 ring-ink-muted ring-offset-1 ring-offset-ground',
                    )}
                  />
                );
              })}

              <span
                className={cn(
                  'pl-3 text-sm transition-colors',
                  'duration-[var(--duration-settle)] ease-quart',
                  known && contaminated ? 'font-medium text-ink' : 'text-ink-faint',
                )}
              >
                {known ? (contaminated ? 'Contaminated' : 'Clean') : `${size} loaded`}
              </span>
            </Row>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A row of a CSS grid has no element of its own, so `display: contents` keeps the
 * cells in the parent's column tracks while still grouping them for the reader.
 */
function Row({ children }: { children: ReactNode }) {
  return (
    <div role="row" className="contents">
      {children}
    </div>
  );
}
