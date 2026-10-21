/**
 * Boss Fight. Two players alternately hit a boss for a whole amount of damage in
 * [1, m]. A player may not deal the amount their opponent just dealt (the first hit of
 * the game is unrestricted), and whoever brings the health to zero or below wins. The
 * visitor hits first.
 *
 * A game state is the health and the forbidden amount, and the whole game is decided by
 * classifying each health value `n` by how many *winning hits* it has, ignoring the
 * restriction: a hit `x` is winning when it finishes the boss or leaves the opponent in a
 * losing state `(n - x, x)`.
 *
 *   0 winning hits  -> "evil":    `(n, l)` is losing whatever is forbidden;
 *   1 winning hit   -> "neutral": `(n, l)` is losing exactly when `l` is that hit;
 *   2 or more       -> "good":    `(n, l)` is winning whatever is forbidden.
 *
 * The visitor starts unrestricted, so a game is winnable for them exactly when the
 * opening health is not evil. `levels.ts` deals only such openings, and `boss.test.ts`
 * checks the classification against an exhaustive search.
 *
 * The three levels follow from where the evil health values sit. With `h = (m + 1) / 2`:
 *
 *   - even m:  the evil values are exactly the multiples of m + 1. Answer every hit `x`
 *              with `m + 1 - x`; it is never the same as `x` because m + 1 is odd.
 *   - odd m, and m + 1 has an even number of factors of 2:  still exactly the multiples
 *              of m + 1, although the hit `h` now has to be answered differently.
 *   - odd m, and m + 1 has an odd number of factors of 2:  the hit `h` is its own mirror
 *              image and the evil values drift off the multiples; consecutive ones are
 *              m + 1 or m + 2 apart with no closed form.
 */

export type Position = {
  readonly health: number;
  /** The amount the opponent just dealt, or 0 when nothing is forbidden. */
  readonly forbidden: number;
};

export type Kind = 'good' | 'neutral' | 'evil';

export type Table = {
  readonly m: number;
  /** `kind[n]` for every health 0..max; index 0 is evil, the player to move has lost. */
  readonly kind: readonly Kind[];
  /** For a neutral `n`, its single winning hit. 0 elsewhere. */
  readonly only: readonly number[];
};

export type Rng = () => number;

export function legalHits(m: number, p: Position): number[] {
  const hits: number[] = [];
  for (let x = 1; x <= m; x += 1) if (x !== p.forbidden) hits.push(x);
  return hits;
}

/** The classification of every health value up to `maxHealth`, in O(maxHealth * m). */
export function classify(m: number, maxHealth: number): Table {
  const kind: Kind[] = ['evil'];
  const only: number[] = [0];
  for (let n = 1; n <= maxHealth; n += 1) {
    let count = 0;
    let last = 0;
    for (let x = 1; x <= m; x += 1) {
      const left = n - x;
      const winning =
        left <= 0 || kind[left] === 'evil' || (kind[left] === 'neutral' && only[left] === x);
      if (winning) {
        count += 1;
        last = x;
      }
    }
    kind.push(count === 0 ? 'evil' : count === 1 ? 'neutral' : 'good');
    only.push(count === 1 ? last : 0);
  }
  return { m, kind, only };
}

function kindAt(table: Table, health: number): Kind {
  if (health <= 0) return 'evil';
  const k = table.kind[health];
  if (k === undefined) throw new Error(`Health ${health} is beyond the table`);
  return k;
}

/** Is the player to move at `p` lost against perfect play? */
export function isLosing(table: Table, p: Position): boolean {
  const k = kindAt(table, p.health);
  if (k === 'evil') return true;
  if (k === 'good') return false;
  return table.only[p.health] === p.forbidden;
}

export function isWinningHit(table: Table, p: Position, hit: number): boolean {
  if (hit < 1 || hit > table.m || hit === p.forbidden) return false;
  const left = p.health - hit;
  return left <= 0 || isLosing(table, { health: left, forbidden: hit });
}

export function winningHits(table: Table, p: Position): number[] {
  return legalHits(table.m, p).filter((hit) => isWinningHit(table, p, hit));
}

function pick<T>(items: readonly T[], rng: Rng): T {
  const chosen = items[Math.floor(rng() * items.length)] ?? items[0];
  if (chosen === undefined) throw new Error('pick() from an empty list');
  return chosen;
}

/**
 * From a lost position every hit loses to perfect play, so rank by how likely an
 * imperfect opponent is to go wrong: fewest winning replies as a share of all replies.
 * Ties go to whichever hit leaves more health, since a longer game gives a guessing
 * visitor more chances to hand the game back.
 */
function trapHit(table: Table, p: Position, rng: Rng): number {
  const candidates = legalHits(table.m, p).map((hit) => {
    const next: Position = { health: p.health - hit, forbidden: hit };
    const replies = legalHits(table.m, next).length;
    return {
      hit,
      risk: winningHits(table, next).length / replies,
      healthLeft: next.health,
    };
  });

  let best = candidates[0];
  if (best === undefined) throw new Error('No legal hits from a live position');
  for (const candidate of candidates) {
    if (
      candidate.risk < best.risk ||
      (candidate.risk === best.risk && candidate.healthLeft > best.healthLeft)
    ) {
      best = candidate;
    }
  }

  const tied = candidates.filter(
    (c) => c.risk === best.risk && c.healthLeft === best.healthLeft,
  );
  return pick(tied, rng).hit;
}

/**
 * The bot. Plays perfectly: it finishes the boss when it can, never gives up a won
 * position, and makes a lost position as awkward as possible. Returns null only when
 * the game is already over.
 */
export function bestHit(table: Table, p: Position, rng: Rng = Math.random): number | null {
  if (p.health <= 0) return null;
  const finishing = legalHits(table.m, p).filter((hit) => hit >= p.health);
  if (finishing.length > 0) return pick(finishing, rng);
  const winning = winningHits(table, p);
  return winning.length > 0 ? pick(winning, rng) : trapHit(table, p, rng);
}

/** How many factors of 2 a positive integer has. */
export function v2(k: number): number {
  if (k <= 0 || !Number.isInteger(k)) throw new Error(`v2 of ${k}`);
  let count = 0;
  let rest = k;
  while (rest % 2 === 0) {
    rest /= 2;
    count += 1;
  }
  return count;
}

export type Tier = 'easy' | 'medium' | 'hard';

/** Which level a damage limit belongs to; see the note at the top of this file. */
export function tierOf(m: number): Tier {
  if (m % 2 === 0) return 'easy';
  return v2(m + 1) % 2 === 0 ? 'medium' : 'hard';
}
