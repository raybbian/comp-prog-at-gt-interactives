import { classify, tierOf, type Rng, type Tier } from './boss';

export type Level = Tier;

export type Opening = {
  readonly health: number;
  readonly m: number;
};

/**
 * The damage limits each level draws from. `levels.test.ts` checks every one against
 * `tierOf`, so a limit cannot end up on the wrong level. Nothing goes above 15: the hit
 * pad is five keys across, and three rows is as tall as a phone has room for under the
 * health bar.
 */
export const LEVEL_LIMITS: Record<Level, readonly number[]> = {
  easy: [4, 6, 8, 10],
  medium: [3, 11, 15],
  hard: [5, 7, 9, 13],
};

export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];

export const LEVEL_LABELS: Record<Level, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/** Opening health is between these multiples of m + 1: a game of roughly 6 to 12 hits. */
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 6;

/**
 * Every opening a level can deal: each limit in its pool, with every health in the window
 * from which the visitor, who hits first, can force a win. On Easy and Medium that is
 * "not a multiple of m + 1"; on Hard it has to be computed, because the losing values
 * drift off the multiples. Either way it is read off the table rather than assumed.
 */
export function openingsFor(level: Level): Opening[] {
  const openings: Opening[] = [];
  for (const m of LEVEL_LIMITS[level]) {
    const top = MAX_ROUNDS * (m + 1);
    const table = classify(m, top);
    for (let health = MIN_ROUNDS * (m + 1); health <= top; health += 1) {
      if (table.kind[health] !== 'evil') openings.push({ health, m });
    }
  }
  return openings;
}

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
 * Bag randomisation rather than independent draws, as nim's dealer: the whole pool is
 * dealt before reshuffling, and the boundary is fixed so the same opening never comes
 * twice in a row.
 */
export function createDealer(level: Level, rng: Rng = Math.random): () => Opening {
  const pool = openingsFor(level);
  let bag: Opening[] = [];
  let lastDealt: Opening | undefined;

  return () => {
    if (bag.length === 0) {
      bag = shuffle(pool, rng);
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
    const next = bag.pop() ?? pool[0];
    if (next === undefined) throw new Error(`No openings for level ${level}`);
    lastDealt = next;
    return next;
  };
}

/** Exported for the tests, which make sure the pools match the rule the levels rest on. */
export function levelOfLimit(m: number): Level {
  return tierOf(m);
}
