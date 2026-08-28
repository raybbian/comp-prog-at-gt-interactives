import { cn, MicroLabel } from '@cpatgt/shared';
import { rowLabel, type Heaps, type Move } from '../game/nim';
import { Stone, type StoneState } from './Stone';

export type Selection = {
  row: number;
  /** Index of the first stone in the take; everything after it in the row goes too. */
  from: number;
};

export type BoardProps = {
  opening: Heaps;
  heaps: Heaps;
  selection: Selection | null;
  hint: Move | null;
  lastRemoved: Selection | null;
  interactive: boolean;
  staggerMs: number;
  onPreview: (selection: Selection) => void;
  onClearPreview: () => void;
  onSelect: (selection: Selection) => void;
};

function stoneState(
  index: number,
  remaining: number,
  isSelected: boolean,
  isHinted: boolean,
): StoneState {
  if (index >= remaining) return 'gone';
  if (isSelected) return 'staged';
  if (isHinted) return 'hinted';
  return 'live';
}

export function Board({
  opening,
  heaps,
  selection,
  hint,
  lastRemoved,
  interactive,
  staggerMs,
  onPreview,
  onClearPreview,
  onSelect,
}: BoardProps) {
  return (
    <ul className="flex flex-col gap-1">
      {opening.map((size, row) => {
        const remaining = heaps[row] ?? 0;
        const hintFrom = hint !== null && hint.row === row ? remaining - hint.count : null;

        return (
          <li
            key={row}
            onPointerLeave={onClearPreview}
            className="flex items-center gap-4 py-1"
          >
            <MicroLabel className="w-4 shrink-0 tabular-nums">{rowLabel(row)}</MicroLabel>

            <div className="flex flex-1 items-center">
              {Array.from({ length: size }, (_, index) => {
                const isSelected =
                  selection !== null &&
                  selection.row === row &&
                  index >= selection.from &&
                  index < remaining;
                const isHinted = hintFrom !== null && index >= hintFrom && index < remaining;
                const staggerBase =
                  lastRemoved !== null && lastRemoved.row === row ? lastRemoved.from : null;
                const delayMs =
                  staggerBase !== null && index >= staggerBase && index >= remaining
                    ? (index - staggerBase) * staggerMs
                    : 0;

                return (
                  <Stone
                    key={index}
                    state={stoneState(index, remaining, isSelected, isHinted)}
                    label={`Take ${remaining - index} from row ${rowLabel(row)}`}
                    interactive={interactive}
                    delayMs={delayMs}
                    onPreview={() => onPreview({ row, from: index })}
                    onSelect={() => onSelect({ row, from: index })}
                  />
                );
              })}
            </div>

            <span
              className={cn(
                'w-6 shrink-0 text-right font-mono text-sm tnum',
                remaining === 0 ? 'text-ink-faint' : 'text-ink-muted',
              )}
            >
              {remaining}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
