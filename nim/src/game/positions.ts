import type { Heaps, Rng } from './nim';

/**
 * Every valid three-row opening, and `positions.test.ts` enforces what makes one
 * valid:
 *
 *  - 3 rows of 1–7 stones, written ascending so the board reads as a staircase;
 *  - non-zero nim-sum, so the visitor (who moves first) can always force the win;
 *  - 11–18 stones total, which lands a game between roughly 4 and 8 moves;
 *  - every winning move is a *partial* take. Openings where the right answer is
 *    "clear a whole row" teach the rule badly, because clearing a row is also the
 *    move people reach for by instinct.
 *
 * That set happens to be exactly nineteen boards, so the pool is the whole set
 * rather than a hand-picked subset. Some have one winning reply and some have
 * three; the unforgiving ones and the gentler ones both turn up at the booth.
 */
export const OPENINGS: readonly Heaps[] = [
  [1, 3, 7],
  [1, 4, 6],
  [1, 4, 7],
  [1, 5, 6],
  [1, 5, 7],
  [2, 3, 6],
  [2, 3, 7],
  [2, 4, 5],
  [2, 4, 7],
  [2, 5, 6],
  [2, 6, 7],
  [3, 4, 5],
  [3, 4, 6],
  [3, 5, 7],
  [3, 6, 7],
  [4, 5, 6],
  [4, 5, 7],
  [4, 6, 7],
  [5, 6, 7],
];

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

/**
 * Bag randomisation rather than independent draws: a queue is dealt out in full
 * before reshuffling, so a visitor watching over someone's shoulder never sees the
 * same board twice in a row, and the booth cycles through the whole set over an
 * afternoon instead of landing on one opening five times.
 */
export function createDealer(rng: Rng = Math.random): () => Heaps {
  let bag: Heaps[] = [];
  let lastDealt: Heaps | undefined;

  return () => {
    if (bag.length === 0) {
      bag = shuffle(OPENINGS, rng);
      // Dealing is a pop, so the boundary repeat to avoid is at the tail.
      const tail = bag.length - 1;
      if (tail > 0 && bag[tail] === lastDealt) {
        const swap = Math.floor(rng() * tail);
        const last = bag[tail];
        const other = bag[swap];
        if (last !== undefined && other !== undefined) {
          bag[tail] = other;
          bag[swap] = last;
        }
      }
    }
    const next = bag.pop() ?? OPENINGS[0];
    if (next === undefined) throw new Error('OPENINGS is empty');
    lastDealt = next;
    return next;
  };
}
