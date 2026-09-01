/**
 * Snake generators, one per round shape. All are pure functions of a seed, so every
 * team in a round sees the same picture and any round can be reproduced afterwards
 * from its seed alone.
 *
 * Each generator returns the snake as an ordered path. Order matters only where the
 * round hands the shape to both players and puts the information in the colours; for
 * the monochrome rounds either traversal paints the same grid, which is all the scorer
 * compares.
 */

import { type CellIndex, type Size, colOf, index, neighbours, rowOf } from './grid.ts';
import { type Direction, canExtend, step } from './paths.ts';
import { type Rng, randInt, shuffled } from './rng.ts';

/** Enough backtracking for a 60-cell snake on 14x14; far more than the small grids need. */
const NODE_BUDGET = 400_000;
const RESTARTS = 200;

function allCells(size: Size): CellIndex[] {
  return Array.from({ length: size.w * size.h }, (_, i) => i);
}

function turnTo(dir: Direction, turn: number): Direction {
  return ((((dir + turn) % 4) + 4) % 4) as Direction;
}

/**
 * A straight segment. The warm-up round, and the one place where naive is optimal:
 * row, column and length is three digits, which is already inside one message.
 */
export function generateStraight(
  size: Size,
  rng: Rng,
  minLength: number,
  maxLength: number,
): CellIndex[] {
  const length = minLength + randInt(rng, maxLength - minLength + 1);
  const horizontal = rng() < 0.5;
  const span = horizontal ? size.w : size.h;
  const across = horizontal ? size.h : size.w;
  const start = randInt(rng, span - length + 1);
  const line = randInt(rng, across);

  const path: CellIndex[] = [];
  for (let n = 0; n < length; n += 1) {
    const offset = start + n;
    path.push(horizontal ? index(size, line, offset) : index(size, offset, line));
  }
  return rng() < 0.5 ? path : path.reverse();
}

/**
 * A random induced snake of exactly `length` cells: randomised depth-first search with
 * backtracking, restarted from a fresh cell if a start turns out to be a dead end.
 *
 * The induced rule prunes hard — a candidate cell has to touch the snake at the head
 * and nowhere else — which is what stops this degenerating into a space-filling blob
 * and gives the loose, legible shapes the game wants.
 */
export function generateInduced(size: Size, rng: Rng, length: number): CellIndex[] {
  const starts = shuffled(rng, allCells(size));

  for (let attempt = 0; attempt < Math.min(RESTARTS, starts.length); attempt += 1) {
    const start = starts[attempt] as CellIndex;
    const path: CellIndex[] = [start];
    const occupied = new Set<CellIndex>([start]);
    const options: CellIndex[][] = [shuffled(rng, neighbours(size, start))];
    let nodes = 0;

    while (path.length > 0 && nodes < NODE_BUDGET) {
      if (path.length === length) return path;
      nodes += 1;

      const choices = options[options.length - 1] as CellIndex[];
      const head = path[path.length - 1] as CellIndex;
      const next = choices.pop();

      if (next === undefined) {
        options.pop();
        const dead = path.pop();
        if (dead !== undefined) occupied.delete(dead);
        continue;
      }
      if (!canExtend(size, occupied, head, next)) continue;

      path.push(next);
      occupied.add(next);
      options.push(shuffled(rng, neighbours(size, next)));
    }
  }
  throw new Error(`no induced path of length ${length} on ${size.w}x${size.h}`);
}

/**
 * An induced snake made of exactly `segments` straight runs joined by 90-degree turns.
 *
 * The axis therefore alternates on its own, so the only free choice at a joint is left
 * or right — which is the whole reason this round's best encoding is so much smaller
 * than a per-step chain code. Being induced also forces parallel runs at least two
 * apart, which is what gives the shape its open, ladder-like look.
 */
export function generateRectilinear(
  size: Size,
  rng: Rng,
  segments: number,
  minRun: number,
  maxRun: number,
): CellIndex[] {
  const allRuns = Array.from({ length: maxRun - minRun + 1 }, (_, i) => minRun + i);

  /**
   * Try long runs first. Plain shuffling finds a legal snake just as often but picks a
   * short run as readily as a long one, and this round only teaches anything if the
   * straightaways are visibly straightaways — the jitter keeps the shapes varied without
   * giving up the bias.
   */
  const runOrder = (): number[] =>
    allRuns
      .map((run) => ({ run, key: run + rng() * 5 }))
      .sort((a, b) => b.key - a.key)
      .map(({ run }) => run);

  const search = (
    path: CellIndex[],
    occupied: Set<CellIndex>,
    dir: Direction,
    left: number,
  ): CellIndex[] | null => {
    if (left === 0) return path.slice();

    for (const turn of shuffled(rng, [-1, 1])) {
      const next = turnTo(dir, turn);
      for (const run of runOrder()) {
        const added: CellIndex[] = [];
        let ok = true;
        for (let n = 0; n < run; n += 1) {
          const head = path[path.length - 1] as CellIndex;
          const cell = step(size, head, next);
          if (cell === null || !canExtend(size, occupied, head, cell)) {
            ok = false;
            break;
          }
          path.push(cell);
          occupied.add(cell);
          added.push(cell);
        }
        if (ok) {
          const found = search(path, occupied, next, left - 1);
          if (found !== null) return found;
        }
        for (let n = added.length - 1; n >= 0; n -= 1) {
          occupied.delete(added[n] as CellIndex);
          path.pop();
        }
      }
    }
    return null;
  };

  for (const start of shuffled(rng, allCells(size)).slice(0, RESTARTS)) {
    for (const dir of shuffled(rng, [0, 1, 2, 3])) {
      for (const run of runOrder()) {
        const path: CellIndex[] = [start];
        const occupied = new Set<CellIndex>([start]);
        let ok = true;
        for (let n = 1; n < run; n += 1) {
          const head = path[path.length - 1] as CellIndex;
          const cell = step(size, head, dir as Direction);
          if (cell === null || !canExtend(size, occupied, head, cell)) {
            ok = false;
            break;
          }
          path.push(cell);
          occupied.add(cell);
        }
        if (!ok) continue;
        const found = search(path, occupied, dir as Direction, segments - 1);
        if (found !== null) return found;
      }
    }
  }
  throw new Error(`no rectilinear snake of ${segments} segments on ${size.w}x${size.h}`);
}

/**
 * Levels along the body: a reflected random walk that moves by exactly one step of the
 * ramp two times in three, and holds the third.
 *
 * The point of the round is that neighbouring cells look alike, so the sequence is
 * cheap to send as differences and expensive to send outright. Runs are short by
 * construction, which is what makes run-length encoding actively worse here than
 * sending the levels raw.
 */
/** A level in `1..levels` that is not `avoid`, so a run always ends where it looks like it does. */
function otherLevel(rng: Rng, levels: number, avoid: number): number {
  const pick = 1 + randInt(rng, levels - 1);
  return pick >= avoid ? pick + 1 : pick;
}

/**
 * Every cell a different colour from the one before it.
 *
 * The teaching round's whole job is that a colour has to be said out loud, one per cell,
 * before anyone has thought about being clever. Repeats would let a pair get lucky and
 * skip the only thing the round is for.
 */
export function generateVaried(rng: Rng, length: number, levels: number): number[] {
  const out: number[] = [1 + randInt(rng, levels)];
  for (let n = 1; n < length; n += 1) {
    out.push(otherLevel(rng, levels, out[n - 1] as number));
  }
  return out;
}

/**
 * Long blocks of one colour, so run-length encoding is the thing that wins.
 *
 * The pair who send a colour per cell pay the length of the snake; the pair who notice the
 * blocks pay the number of blocks. That gap is the round, which is why the runs are long
 * enough that counting them is obviously worth doing.
 */
export function generateSplotches(
  rng: Rng,
  length: number,
  levels: number,
  minRun: number,
  maxRun: number,
): number[] {
  const out: number[] = [];
  let level = 1 + randInt(rng, levels);
  while (out.length < length) {
    const run = minRun + randInt(rng, maxRun - minRun + 1);
    for (let i = 0; i < run && out.length < length; i += 1) out.push(level);
    level = otherLevel(rng, levels, level);
  }
  return out;
}

export function pathBounds(
  size: Size,
  path: readonly CellIndex[],
): { top: number; left: number; bottom: number; right: number } {
  let top = size.h;
  let left = size.w;
  let bottom = -1;
  let right = -1;
  for (const cell of path) {
    const r = rowOf(size, cell);
    const c = colOf(size, cell);
    if (r < top) top = r;
    if (r > bottom) bottom = r;
    if (c < left) left = c;
    if (c > right) right = c;
  }
  return { top, left, bottom, right };
}
