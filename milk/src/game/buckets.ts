/**
 * Twenty buckets of milk, one of them contaminated, and as many test kits as the
 * visitor decides to use.
 *
 * A kit takes a sample from as many buckets as you like, but only works once — and
 * every kit runs together, so all of them have to be loaded before any of them
 * answers. That makes the whole game one decision: which buckets go into which kits.
 *
 * A loading gives each bucket a signature, the set of kits it went into. When the
 * results come back, every bucket whose signature matches them is still a suspect.
 * So the visitor wins exactly when all twenty signatures are different, and `k` kits
 * make only `2 ** k` signatures available. Twenty buckets need five kits; four give
 * sixteen signatures for twenty buckets and cannot be enough.
 *
 * Nothing is contaminated when the game starts, and which bucket it turns out to be
 * depends on how well the grid was built:
 *
 *  - a perfect grid, where every bucket has its own signature, leaves the machine no
 *    way to punish anyone, so the bucket is simply picked at random and the visitor
 *    reads it straight off the results;
 *  - any other grid is answered adversarially. The machine names whichever signature
 *    the most buckets share and, when the visitor finally picks one of them, says it
 *    was a different one. A grid with a repeat in it is a loss, not a coin toss.
 */

export type Rng = () => number;

export const BUCKET_COUNT = 20;

/** Enough to tell twenty buckets apart. The answer to the riddle. */
export const KITS_NEEDED = 5;

export const MIN_KITS = 1;
/** Well past what anyone needs; the grid stops being readable much beyond this. */
export const MAX_KITS = 10;
export const START_KITS = 1;

/** One bitmask per bucket: bit `k` is set when the bucket went into kit `k`. */
export type Loading = readonly number[];

export function emptyLoading(): number[] {
  return Array.from({ length: BUCKET_COUNT }, () => 0);
}

/** Bucket `i` into every kit whose bit is set in `i`. The loading that works. */
export function binaryLoading(): number[] {
  return Array.from({ length: BUCKET_COUNT }, (_, bucket) => bucket);
}

export function allBuckets(): number[] {
  return Array.from({ length: BUCKET_COUNT }, (_, i) => i);
}

export function kitRange(kitCount: number): number[] {
  return Array.from({ length: kitCount }, (_, i) => i);
}

export function isIn(loading: Loading, bucket: number, kit: number): boolean {
  return (((loading[bucket] ?? 0) >> kit) & 1) === 1;
}

export function setIn(
  loading: Loading,
  bucket: number,
  kit: number,
  on: boolean,
): number[] {
  return loading.map((mask, b) =>
    b === bucket ? (on ? mask | (1 << kit) : mask & ~(1 << kit)) : mask,
  );
}

/** Drops every kit from `kitCount` up, so a removed kit takes its samples with it. */
export function truncateTo(loading: Loading, kitCount: number): number[] {
  const keep = (1 << kitCount) - 1;
  return loading.map((mask) => mask & keep);
}

export function kitSize(loading: Loading, kit: number): number {
  return allBuckets().filter((bucket) => isIn(loading, bucket, kit)).length;
}

export function samplesLoaded(loading: Loading, kitCount: number): number {
  return kitRange(kitCount).reduce((total, kit) => total + kitSize(loading, kit), 0);
}

/** The first pair of buckets loaded into exactly the same kits, in bucket order. */
export function firstCollision(loading: Loading): [number, number] | null {
  const seen = new Map<number, number>();
  for (const bucket of allBuckets()) {
    const signature = loading[bucket] ?? 0;
    const earlier = seen.get(signature);
    if (earlier !== undefined) return [earlier, bucket];
    seen.set(signature, bucket);
  }
  return null;
}

export function isDistinct(loading: Loading): boolean {
  return firstCollision(loading) === null;
}

/**
 * Runs every kit: the answer is whichever signature the most buckets share, so the
 * visitor is left with as many suspects as their grid allows.
 *
 * Ties are broken at random. On a perfect grid every signature is unique, so every
 * group is tied at one and this is exactly the promised random draw among all twenty
 * buckets. On any other grid the tie is between groups of equal size, so the toss
 * decides which bucket it was but never whether the visitor can win — the luck it
 * hands out is none.
 */
export function readKits(
  loading: Loading,
  rng: Rng = Math.random,
): { pattern: number; candidates: number[] } {
  const groups = new Map<number, number[]>();
  for (const bucket of allBuckets()) {
    const signature = loading[bucket] ?? 0;
    const group = groups.get(signature);
    if (group === undefined) groups.set(signature, [bucket]);
    else group.push(bucket);
  }

  const worst = Math.max(...[...groups.values()].map((group) => group.length));
  const tied = [...groups].filter(([, group]) => group.length === worst);
  const chosen = tied[Math.floor(rng() * tied.length)] ?? tied[0];
  if (chosen === undefined) throw new Error('a loading always groups into something');
  return { pattern: chosen[0], candidates: chosen[1] };
}

/** True means that kit came back contaminated. */
export function resultOf(pattern: number, kit: number): boolean {
  return ((pattern >> kit) & 1) === 1;
}

/**
 * Which bucket it turns out to have been. Every remaining suspect fits the results
 * just as well, so the machine takes one the visitor did not name — a guess between
 * two buckets is always wrong, never a fifty-fifty.
 *
 * Which of the others it picks is drawn at random, for the same reason the tie above
 * is: the visitor has already lost whichever one it names, so the draw costs them
 * nothing, and always naming the lowest would let a booth queue learn the answer by
 * watching rather than by thinking.
 */
export function pickCulprit(
  candidates: readonly number[],
  named: number,
  rng: Rng = Math.random,
): number {
  const others = candidates.filter((bucket) => bucket !== named);
  return others[Math.floor(rng() * others.length)] ?? named;
}

/** Buckets are stored from zero and shown from one; nobody labels a bucket 0. */
export function bucketLabel(bucket: number): string {
  return String(bucket + 1);
}
