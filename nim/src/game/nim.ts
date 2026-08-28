/**
 * Normal-play Nim. Players alternately take any positive number of stones from a
 * single row; whoever takes the last stone wins.
 *
 * The whole game is decided by the nim-sum (XOR of the row sizes). A position with
 * nim-sum 0 is lost for whoever must move; every other position is won, by moving to
 * a nim-sum of 0. The booth relies on this: openings always have a non-zero nim-sum
 * and the visitor moves first, so a visitor who finds the rule always wins.
 */

export type Heaps = readonly number[];

export type Move = {
  readonly row: number;
  readonly count: number;
};

export type Rng = () => number;

export function nimSum(heaps: Heaps): number {
  return heaps.reduce((acc, n) => acc ^ n, 0);
}

export function totalStones(heaps: Heaps): number {
  return heaps.reduce((acc, n) => acc + n, 0);
}

export function isOver(heaps: Heaps): boolean {
  return totalStones(heaps) === 0;
}

export function isLegal(heaps: Heaps, move: Move): boolean {
  const row = heaps[move.row];
  return row !== undefined && move.count >= 1 && move.count <= row;
}

export function applyMove(heaps: Heaps, move: Move): Heaps {
  if (!isLegal(heaps, move)) {
    throw new Error(`Illegal move: row ${move.row}, count ${move.count}`);
  }
  return heaps.map((n, i) => (i === move.row ? n - move.count : n));
}

export function legalMoves(heaps: Heaps): Move[] {
  const moves: Move[] = [];
  heaps.forEach((size, row) => {
    for (let count = 1; count <= size; count += 1) moves.push({ row, count });
  });
  return moves;
}

/**
 * Every move that leaves a nim-sum of 0. Derived rather than searched: a row can be
 * reduced to `size ^ s` exactly when that value is smaller than the row, which is
 * true precisely for rows carrying the high bit of the nim-sum. Empty when the
 * position is already lost.
 */
export function winningMoves(heaps: Heaps): Move[] {
  const s = nimSum(heaps);
  if (s === 0) return [];
  const moves: Move[] = [];
  heaps.forEach((size, row) => {
    const target = size ^ s;
    if (target < size) moves.push({ row, count: size - target });
  });
  return moves;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  const chosen = items[Math.floor(rng() * items.length)] ?? items[0];
  if (chosen === undefined) throw new Error('pick() from an empty list');
  return chosen;
}

/**
 * From a lost position every move loses to perfect play, so rank by how likely an
 * imperfect opponent is to go wrong: fewest winning replies as a share of all
 * replies. Ties go to whichever move leaves more stones on the board, since a
 * longer game gives a guessing visitor more chances to hand the game back.
 */
function trapMove(heaps: Heaps, rng: Rng): Move {
  const candidates = legalMoves(heaps).map((move) => {
    const next = applyMove(heaps, move);
    const replies = legalMoves(next).length;
    return {
      move,
      // No replies means we just took the last stone, which is an outright win.
      risk: replies === 0 ? -1 : winningMoves(next).length / replies,
      stonesLeft: totalStones(next),
    };
  });

  let best = candidates[0];
  if (best === undefined) throw new Error('No legal moves from a non-terminal position');
  for (const candidate of candidates) {
    if (
      candidate.risk < best.risk ||
      (candidate.risk === best.risk && candidate.stonesLeft > best.stonesLeft)
    ) {
      best = candidate;
    }
  }

  const tied = candidates.filter(
    (c) => c.risk === best.risk && c.stonesLeft === best.stonesLeft,
  );
  return pick(tied, rng).move;
}

/**
 * The bot. Plays perfectly: it never gives up a won position, and it makes a lost
 * position as awkward as possible. Returns null only when the game is already over.
 */
export function bestMove(heaps: Heaps, rng: Rng = Math.random): Move | null {
  if (isOver(heaps)) return null;
  const winning = winningMoves(heaps);
  return winning.length > 0 ? pick(winning, rng) : trapMove(heaps, rng);
}

const ROW_LABELS = 'ABCDEFGH';

export function rowLabel(row: number): string {
  return ROW_LABELS[row] ?? String(row + 1);
}

export function describeMove(move: Move): string {
  return `${move.count} from row ${rowLabel(move.row)}`;
}
