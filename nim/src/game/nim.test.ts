import { describe, expect, it } from 'vitest';
import {
  applyMove,
  bestMove,
  isOver,
  legalMoves,
  nimSum,
  rowLabel,
  totalStones,
  winningMoves,
  type Heaps,
  type Move,
  type Rng,
} from './nim';
import { createDealer, OPENINGS } from './positions';

/** Deterministic RNG so a failure is reproducible from the seed alone. */
function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ground truth by exhaustive search, deliberately independent of the nim-sum rule.
 * If this and `nimSum` ever disagree, the theory the whole booth rests on is wrong.
 */
const memo = new Map<string, boolean>();
function moverWins(heaps: Heaps): boolean {
  const key = [...heaps].sort((a, b) => a - b).join(',');
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  // Nobody to move against an empty board: the previous player took the last stone.
  let result = false;
  for (const move of legalMoves(heaps)) {
    if (!moverWins(applyMove(heaps, move))) {
      result = true;
      break;
    }
  }
  memo.set(key, result);
  return result;
}

type Player = (heaps: Heaps) => Move;

/** Returns 0 if the player who moved first won, 1 otherwise. */
function playOut(heaps: Heaps, players: [Player, Player]): 0 | 1 {
  let position = heaps;
  let turn: 0 | 1 = 0;
  while (!isOver(position)) {
    const player = players[turn];
    const move = player(position);
    position = applyMove(position, move);
    if (isOver(position)) return turn;
    turn = turn === 0 ? 1 : 0;
  }
  throw new Error('playOut called on a finished game');
}

const perfect =
  (rng: Rng): Player =>
  (heaps) => {
    const move = bestMove(heaps, rng);
    if (move === null) throw new Error('no move from a live position');
    return move;
  };

const randomPlayer =
  (rng: Rng): Player =>
  (heaps) => {
    const moves = legalMoves(heaps);
    const move = moves[Math.floor(rng() * moves.length)];
    if (move === undefined) throw new Error('no legal moves');
    return move;
  };

/** All positions with up to 4 rows of up to 6 stones, ignoring row order. */
function enumeratePositions(): Heaps[] {
  const out: Heaps[] = [];
  for (let a = 0; a <= 6; a += 1)
    for (let b = a; b <= 6; b += 1)
      for (let c = b; c <= 6; c += 1)
        for (let d = c; d <= 6; d += 1) out.push([a, b, c, d]);
  return out;
}

const POSITIONS = enumeratePositions();

describe('primitives', () => {
  it('computes the nim-sum as the xor of row sizes', () => {
    expect(nimSum([1, 3, 5, 7])).toBe(0);
    expect(nimSum([3, 4, 5])).toBe(2);
    expect(nimSum([])).toBe(0);
  });

  it('counts stones and detects the end of the game', () => {
    expect(totalStones([1, 4, 6])).toBe(11);
    expect(isOver([0, 0, 0])).toBe(true);
    expect(isOver([0, 0, 1])).toBe(false);
  });

  it('applies a move without mutating the position it was given', () => {
    const before: Heaps = [1, 4, 6];
    const after = applyMove(before, { row: 2, count: 3 });
    expect(after).toEqual([1, 4, 3]);
    expect(before).toEqual([1, 4, 6]);
  });

  it('rejects illegal moves', () => {
    expect(() => applyMove([1, 2], { row: 0, count: 2 })).toThrow();
    expect(() => applyMove([1, 2], { row: 0, count: 0 })).toThrow();
    expect(() => applyMove([1, 2], { row: 5, count: 1 })).toThrow();
  });

  it('offers one move per takeable prefix of every row', () => {
    expect(legalMoves([2, 3]).length).toBe(5);
    expect(legalMoves([0, 0]).length).toBe(0);
  });

  it('labels rows for display', () => {
    expect(rowLabel(0)).toBe('A');
    expect(rowLabel(3)).toBe('D');
  });
});

describe('the nim-sum rule', () => {
  it('matches exhaustive search on every position up to 4 rows of 6', () => {
    for (const heaps of POSITIONS) {
      expect(moverWins(heaps)).toBe(nimSum(heaps) !== 0);
    }
  });

  it('finds winning moves exactly when the position is winnable', () => {
    for (const heaps of POSITIONS) {
      const moves = winningMoves(heaps);
      expect(moves.length > 0).toBe(nimSum(heaps) !== 0);
      for (const move of moves) {
        expect(nimSum(applyMove(heaps, move))).toBe(0);
      }
    }
  });
});

describe('the bot', () => {
  const rng = mulberry32(1);

  it('returns null only when the game is over', () => {
    expect(bestMove([0, 0, 0], rng)).toBeNull();
    expect(bestMove([0, 0, 1], rng)).not.toBeNull();
  });

  it('always plays a legal move, including from lost positions', () => {
    for (const heaps of POSITIONS) {
      const move = bestMove(heaps, rng);
      if (isOver(heaps)) {
        expect(move).toBeNull();
        continue;
      }
      expect(move).not.toBeNull();
      expect(() => applyMove(heaps, move as Move)).not.toThrow();
    }
  });

  it('never gives up a won position', () => {
    for (const heaps of POSITIONS) {
      if (nimSum(heaps) === 0) continue;
      const move = bestMove(heaps, rng);
      expect(nimSum(applyMove(heaps, move as Move))).toBe(0);
    }
  });

  it('beats a perfect opponent from every position where theory says it should', () => {
    const opponent = perfect(mulberry32(7));
    for (const heaps of POSITIONS) {
      if (isOver(heaps) || nimSum(heaps) === 0) continue;
      expect(playOut(heaps, [perfect(rng), opponent])).toBe(0);
    }
  });
});

describe('the booth guarantee', () => {
  it('lets a perfect visitor win every curated opening', () => {
    const visitor = perfect(mulberry32(11));
    const bot = perfect(mulberry32(23));
    for (const opening of OPENINGS) {
      expect(playOut(opening, [visitor, bot])).toBe(0);
    }
  });

  it('punishes a visitor who guesses', () => {
    const bot = perfect(mulberry32(31));
    let botWins = 0;
    let games = 0;
    for (const opening of OPENINGS) {
      for (let seed = 0; seed < 40; seed += 1) {
        games += 1;
        if (playOut(opening, [randomPlayer(mulberry32(seed)), bot]) === 1) botWins += 1;
      }
    }
    // Guessing correctly through a whole game is possible, just rare.
    expect(botWins / games).toBeGreaterThan(0.8);
  });
});

describe('curated openings', () => {
  it('meet every criterion the booth depends on', () => {
    for (const opening of OPENINGS) {
      expect(opening.length).toBe(3);
      expect(Math.min(...opening)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...opening)).toBeLessThanOrEqual(7);
      expect(nimSum(opening)).not.toBe(0);
      expect(totalStones(opening)).toBeGreaterThanOrEqual(11);
      expect(totalStones(opening)).toBeLessThanOrEqual(18);
      expect(new Set(opening).size).toBeGreaterThan(1);
      expect([...opening]).toEqual([...opening].sort((a, b) => a - b));
      for (const move of winningMoves(opening)) {
        expect(move.count).toBeLessThan(opening[move.row] as number);
      }
    }
  });

  it('deals the whole set before repeating, and never twice in a row', () => {
    const deal = createDealer(mulberry32(5));
    const first = Array.from({ length: OPENINGS.length }, deal);
    expect(new Set(first).size).toBe(OPENINGS.length);

    const long = Array.from({ length: OPENINGS.length * 5 }, deal);
    for (let i = 1; i < long.length; i += 1) {
      expect(long[i]).not.toBe(long[i - 1]);
    }
  });
});
