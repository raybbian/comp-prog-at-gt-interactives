/**
 * A grid is a string of `w * h` digits, read row-major.
 *
 *   '0'        an empty cell
 *   '1'..'9'   a body cell at that palette level
 *
 * A digit per cell is not a coincidence. The whole game is digits, the palette index
 * a player reads off the picture is the digit they type, and a grid compares for
 * equality with `===` — which is the entire scoring rule now that there is no partial
 * credit. Monochrome rounds only ever use '1'.
 */

export type Grid = string;

export type Size = { readonly w: number; readonly h: number };

/** A cell as an index into the grid string. Coordinates are (row, col), never (x, y). */
export type CellIndex = number;

export const EMPTY = '0';

export function index({ w }: Size, row: number, col: number): CellIndex {
  return row * w + col;
}

export function rowOf({ w }: Size, i: CellIndex): number {
  return Math.floor(i / w);
}

export function colOf({ w }: Size, i: CellIndex): number {
  return i % w;
}

export function inBounds({ w, h }: Size, row: number, col: number): boolean {
  return row >= 0 && row < h && col >= 0 && col < w;
}

export function blank(size: Size): Grid {
  return EMPTY.repeat(size.w * size.h);
}

export function at(grid: Grid, i: CellIndex): string {
  return grid[i] ?? EMPTY;
}

export function isBody(grid: Grid, i: CellIndex): boolean {
  return at(grid, i) !== EMPTY;
}

export function withCell(grid: Grid, i: CellIndex, value: string): Grid {
  if (i < 0 || i >= grid.length) return grid;
  return grid.slice(0, i) + value + grid.slice(i + 1);
}

/** The four orthogonal neighbours that are on the board. */
export function neighbours(size: Size, i: CellIndex): CellIndex[] {
  const row = rowOf(size, i);
  const col = colOf(size, i);
  const out: CellIndex[] = [];
  for (const [dr, dc] of [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ] as const) {
    const r = row + dr;
    const c = col + dc;
    if (inBounds(size, r, c)) out.push(index(size, r, c));
  }
  return out;
}

/** Build a grid from an ordered path plus a level per cell. */
export function paint(size: Size, path: readonly CellIndex[], levels: readonly number[]): Grid {
  const cells = new Array<string>(size.w * size.h).fill(EMPTY);
  path.forEach((cell, n) => {
    const level = levels[n] ?? 1;
    cells[cell] = String(level);
  });
  return cells.join('');
}

export function bodyCells(grid: Grid): CellIndex[] {
  const out: CellIndex[] = [];
  for (let i = 0; i < grid.length; i += 1) {
    if (grid[i] !== EMPTY) out.push(i);
  }
  return out;
}

export function sizeOf(grid: Grid, w: number): Size {
  return { w, h: grid.length / w };
}
