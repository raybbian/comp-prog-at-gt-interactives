/**
 * Snakes are *induced* paths: a body cell may only touch another body cell when it is
 * the one immediately before or after it along the snake.
 *
 * That rule does a surprising amount of work. It makes the picture unambiguous — you
 * can trace the snake by eye without wondering which way a coil turns — and it makes a
 * wrong drawing impossible rather than merely wrong, because the receiver's editor
 * enforces the same predicate live. One definition, three consumers: the generator, the
 * editor, and the scorer.
 */

import {
  type CellIndex,
  type Size,
  colOf,
  inBounds,
  index,
  neighbours,
  rowOf,
} from './grid.ts';

/** N, E, S, W — the order the turn tables below assume. */
export const DIRECTIONS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] as const;

export type Direction = 0 | 1 | 2 | 3;

export function step(size: Size, cell: CellIndex, dir: Direction): CellIndex | null {
  const [dr, dc] = DIRECTIONS[dir];
  const r = rowOf(size, cell) + dr;
  const c = colOf(size, cell) + dc;
  return inBounds(size, r, c) ? index(size, r, c) : null;
}

/**
 * Can `cell` be appended to a path whose cells are `occupied` and whose head is the
 * last of them? Legal exactly when the cell is free and touches the path only at the
 * head — which is the induced condition, maintained one step at a time.
 */
export function canExtend(
  size: Size,
  occupied: ReadonlySet<CellIndex>,
  head: CellIndex,
  cell: CellIndex,
): boolean {
  if (occupied.has(cell)) return false;
  let touching = 0;
  for (const n of neighbours(size, cell)) {
    if (!occupied.has(n)) continue;
    if (n !== head) return false;
    touching += 1;
  }
  return touching === 1;
}

/** Full validation, for the scorer and for tests. */
export function isInducedPath(size: Size, path: readonly CellIndex[]): boolean {
  if (path.length === 0) return false;
  const seen = new Set<CellIndex>();
  for (const cell of path) {
    if (cell < 0 || cell >= size.w * size.h) return false;
    if (seen.has(cell)) return false;
    seen.add(cell);
  }
  const position = new Map<CellIndex, number>();
  path.forEach((cell, i) => position.set(cell, i));
  for (let i = 0; i < path.length; i += 1) {
    const cell = path[i] as CellIndex;
    for (const n of neighbours(size, cell)) {
      const j = position.get(n);
      if (j === undefined) continue;
      if (Math.abs(j - i) !== 1) return false;
    }
  }
  return true;
}

/**
 * Recover the ordered path from a set of body cells, if one exists.
 *
 * Because the snake is induced, this is unambiguous and takes no search: exactly two
 * cells have a single body neighbour (the ends), everything else has two, so you walk
 * from one end and never have a choice. That property is why the receiver can be given
 * a shape to fill in without also being told the traversal order.
 */
export function orderPath(size: Size, cells: readonly CellIndex[]): CellIndex[] | null {
  if (cells.length === 0) return null;
  const body = new Set(cells);
  if (body.size !== cells.length) return null;

  const degree = new Map<CellIndex, CellIndex[]>();
  for (const cell of body) {
    degree.set(
      cell,
      neighbours(size, cell).filter((n) => body.has(n)),
    );
  }
  if (cells.length === 1) return [cells[0] as CellIndex];

  const ends = [...body].filter((c) => (degree.get(c) ?? []).length === 1).sort((a, b) => a - b);
  if (ends.length !== 2) return null;

  const path: CellIndex[] = [];
  const seen = new Set<CellIndex>();
  let current = ends[0] as CellIndex;
  let previous: CellIndex | null = null;
  for (;;) {
    path.push(current);
    seen.add(current);
    const next = (degree.get(current) ?? []).filter((n) => n !== previous);
    if (next.length > 1) return null;
    const forward = next[0];
    if (forward === undefined) break;
    if (seen.has(forward)) return null;
    previous = current;
    current = forward;
  }
  return path.length === body.size ? path : null;
}
