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

export type Mover = 'bot' | 'you';

/** The hits a side may consider: the winning ones when it has any, otherwise all of them. */
function candidateHits(table: Table, p: Position): number[] {
  const winning = winningHits(table, p);
  return winning.length > 0 ? winning : legalHits(table.m, p);
}

/**
 * How many more hits the game lasts from `p`, with `mover` to hit, when the bot
 * stretches it out and the visitor cuts it short, and neither side ever gives up a win
 * it holds. That is the length the bot can *guarantee*: a visitor who plays slower only
 * makes the game longer. `memo` is shared across one decision.
 */
export function gameLength(
  table: Table,
  p: Position,
  mover: Mover,
  memo: Map<string, number> = new Map(),
): number {
  if (p.health <= 0) return 0;
  const key = `${mover}:${p.health},${p.forbidden}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  const other: Mover = mover === 'bot' ? 'you' : 'bot';
  let best = mover === 'bot' ? -Infinity : Infinity;
  for (const hit of candidateHits(table, p)) {
    const next: Position = { health: p.health - hit, forbidden: hit };
    const length = 1 + gameLength(table, next, other, memo);
    best = mover === 'bot' ? Math.max(best, length) : Math.min(best, length);
  }
  memo.set(key, best);
  return best;
}

/**
 * The bot. It never gives up a won position, and among the hits that keep its win (or,
 * from a lost position, among all of them) it plays one that keeps the game going the
 * longest, chosen at random when several tie. A longer game is more turns for the
 * visitor to find the pattern, or to slip. This still finishes the boss whenever it can:
 * at health <= m any smaller hit leaves the visitor a finishing reply, so the kill is the
 * only winning hit. Returns null only when the game is already over.
 */
export function bestHit(table: Table, p: Position, rng: Rng = Math.random): number | null {
  if (p.health <= 0) return null;
  const memo = new Map<string, number>();
  const scored = candidateHits(table, p).map((hit) => ({
    hit,
    length: 1 + gameLength(table, { health: p.health - hit, forbidden: hit }, 'you', memo),
  }));
  const longest = Math.max(...scored.map((s) => s.length));
  return pick(
    scored.filter((s) => s.length === longest).map((s) => s.hit),
    rng,
  );
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
