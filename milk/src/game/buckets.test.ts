import { describe, expect, it } from 'vitest';
import {
  allBuckets,
  binaryLoading,
  bucketLabel,
  BUCKET_COUNT,
  emptyLoading,
  firstCollision,
  isDistinct,
  isIn,
  kitRange,
  KITS_NEEDED,
  kitSize,
  MAX_KITS,
  pickCulprit,
  readKits,
  resultOf,
  samplesLoaded,
  setIn,
  truncateTo,
  type Loading,
} from './buckets';

/** Deterministic RNG, used only to generate loadings to test against. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A loading that may only use the first `kits` kits. */
function randomLoading(rng: () => number, kits: number): Loading {
  return allBuckets().map(() => Math.floor(rng() * 2 ** kits));
}

describe('primitives', () => {
  it('lays out twenty buckets, labelled from one', () => {
    expect(allBuckets()).toHaveLength(BUCKET_COUNT);
    expect(bucketLabel(0)).toBe('1');
    expect(bucketLabel(19)).toBe('20');
  });

  it('counts out however many kits are in play', () => {
    expect(kitRange(1)).toEqual([0]);
    expect(kitRange(KITS_NEEDED)).toHaveLength(5);
    expect(kitRange(MAX_KITS)).toHaveLength(MAX_KITS);
  });

  it('starts with nothing loaded', () => {
    const empty = emptyLoading();
    expect(empty).toHaveLength(BUCKET_COUNT);
    expect(samplesLoaded(empty, MAX_KITS)).toBe(0);
  });

  it('puts a bucket into a kit and takes it back out', () => {
    const one = setIn(emptyLoading(), 3, 2, true);
    expect(isIn(one, 3, 2)).toBe(true);
    expect(isIn(one, 3, 1)).toBe(false);
    expect(isIn(one, 4, 2)).toBe(false);
    expect(samplesLoaded(one, KITS_NEEDED)).toBe(1);

    expect(isIn(setIn(one, 3, 2, false), 3, 2)).toBe(false);
  });

  it('setting a cell that is already set changes nothing', () => {
    const one = setIn(emptyLoading(), 3, 2, true);
    expect(setIn(one, 3, 2, true)).toEqual(one);
  });

  it('counts only the kits that exist', () => {
    let loading: Loading = emptyLoading();
    for (const bucket of [1, 4, 9]) loading = setIn(loading, bucket, 0, true);
    loading = setIn(loading, 2, 4, true);

    expect(kitSize(loading, 0)).toBe(3);
    expect(samplesLoaded(loading, 1)).toBe(3);
    expect(samplesLoaded(loading, KITS_NEEDED)).toBe(4);
  });

  it('drops a removed kit and everything poured into it', () => {
    const loading = setIn(setIn(emptyLoading(), 3, 0, true), 3, 4, true);
    const shrunk = truncateTo(loading, 4);

    expect(isIn(shrunk, 3, 4)).toBe(false);
    expect(isIn(shrunk, 3, 0)).toBe(true);
  });

  it('reads a result out of the pattern', () => {
    expect(kitRange(5).map((kit) => resultOf(0b01010, kit))).toEqual([
      false, true, false, true, false,
    ]);
  });
});

describe('telling buckets apart', () => {
  it('finds the first pair loaded into exactly the same kits', () => {
    const clash = [0, 1, 2, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    expect(firstCollision(clash)).toEqual([1, 3]);
    expect(isDistinct(clash)).toBe(false);
  });

  it('calls an empty grid one big collision', () => {
    expect(firstCollision(emptyLoading())).toEqual([0, 1]);
  });

  it('accepts the loading that gives every bucket its own signature', () => {
    expect(isDistinct(binaryLoading())).toBe(true);
    expect(firstCollision(binaryLoading())).toBeNull();
  });
});

describe('the machine', () => {
  it('answers with the signature the most buckets share', () => {
    const loading = setIn(emptyLoading(), 7, 0, true);
    const { pattern, candidates } = readKits(loading, mulberry32(1));

    expect(pattern).toBe(0);
    expect(candidates).toHaveLength(19);
    expect(candidates).not.toContain(7);
  });

  it('leaves the outcome untouched however a tie falls', () => {
    // The only randomness in the game is which of several equally-bad signatures
    // gets announced. It must never change whether the visitor can win.
    for (let seed = 0; seed < 100; seed += 1) {
      const loading = randomLoading(mulberry32(seed), KITS_NEEDED);
      const sizes = new Set<number>();
      for (let toss = 0; toss < 40; toss += 1) {
        sizes.add(readKits(loading, mulberry32(toss * 31 + 7)).candidates.length);
      }
      expect(sizes.size).toBe(1);
    }
  });

  it('draws at random across a perfect grid, so no two visitors get the same answer', () => {
    const found = new Set<number>();
    for (let toss = 0; toss < 400; toss += 1) {
      const { candidates } = readKits(binaryLoading(), mulberry32(toss));
      expect(candidates).toHaveLength(1);
      found.add(candidates[0] as number);
    }
    // Every bucket is reachable: the draw is over all twenty, not a favoured few.
    expect(found.size).toBe(BUCKET_COUNT);
  });

  it('never contradicts itself — every suspect fits the results it gave', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const loading = randomLoading(mulberry32(seed), KITS_NEEDED);
      const { pattern, candidates } = readKits(loading, mulberry32(seed + 1));

      expect(candidates.length).toBeGreaterThan(0);
      for (const bucket of allBuckets()) {
        expect(loading[bucket] === pattern).toBe(candidates.includes(bucket));
      }
    }
  });

  it('gives an empty grid away for nothing', () => {
    expect(readKits(emptyLoading(), mulberry32(1)).candidates).toHaveLength(BUCKET_COUNT);
  });
});

describe('the adversary', () => {
  it('always names a bucket the visitor did not, when it has the choice', () => {
    for (let toss = 0; toss < 200; toss += 1) {
      expect(pickCulprit([2, 5, 9], 5, mulberry32(toss))).not.toBe(5);
      expect(pickCulprit([2, 5, 9], 2, mulberry32(toss))).not.toBe(2);
    }
  });

  it('draws at random from every bucket it could name', () => {
    const named = new Set<number>();
    for (let toss = 0; toss < 200; toss += 1) {
      named.add(pickCulprit([2, 5, 9], 5, mulberry32(toss)));
    }
    // Both of the other two are reachable, and the named one never is.
    expect([...named].sort((a, b) => a - b)).toEqual([2, 9]);
  });

  it('reaches every suspect, not just the first two', () => {
    const pool = [1, 4, 7, 11, 15, 19];
    const named = new Set<number>();
    for (let toss = 0; toss < 400; toss += 1) {
      named.add(pickCulprit(pool, 7, mulberry32(toss)));
    }
    expect([...named].sort((a, b) => a - b)).toEqual([1, 4, 11, 15, 19]);
  });

  it('has no choice when one bucket is left, so a sound reading always wins', () => {
    expect(pickCulprit([5], 5, mulberry32(1))).toBe(5);
  });

  it('turns every guess between two buckets into a loss, never a coin toss', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const loading = randomLoading(mulberry32(seed), KITS_NEEDED);
      const { candidates } = readKits(loading, mulberry32(seed + 5));
      if (candidates.length < 2) continue;

      // Whichever bucket the visitor picks, however they picked it, and however
      // the machine's own draw falls.
      for (const guess of allBuckets()) {
        for (let toss = 0; toss < 5; toss += 1) {
          expect(pickCulprit(candidates, guess, mulberry32(toss))).not.toBe(guess);
        }
      }
    }
  });
});

describe('the booth guarantee', () => {
  it('lets five kits pin the bucket down, whichever bucket it turns out to be', () => {
    const loading = binaryLoading();
    for (let toss = 0; toss < 60; toss += 1) {
      const { pattern, candidates } = readKits(loading, mulberry32(toss));
      expect(candidates).toHaveLength(1);

      // And the results really do spell out that bucket, kit by kit.
      const only = candidates[0] as number;
      for (const kit of kitRange(KITS_NEEDED)) {
        expect(resultOf(pattern, kit)).toBe(isIn(loading, only, kit));
      }
      expect(pickCulprit(candidates, only, mulberry32(toss))).toBe(only);
    }
  });

  it('punishes any grid where two buckets go into the same kits', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const loading = randomLoading(mulberry32(seed), KITS_NEEDED);
      expect(readKits(loading, mulberry32(seed + 9)).candidates.length > 1).toBe(
        !isDistinct(loading),
      );
    }
  });

  it('cannot be done in four kits, however they are used', () => {
    // Twenty buckets into sixteen possible signatures always collides.
    for (let seed = 0; seed < 500; seed += 1) {
      const loading = randomLoading(mulberry32(seed), KITS_NEEDED - 1);
      expect(isDistinct(loading)).toBe(false);
      expect(readKits(loading, mulberry32(seed + 11)).candidates.length).toBeGreaterThan(1);
    }
  });

  it('is not beaten by loading every kit to the brim either', () => {
    // Effort is not the point: every bucket in every kit tells you nothing.
    const everything = allBuckets().map(() => (1 << MAX_KITS) - 1);
    expect(samplesLoaded(everything, MAX_KITS)).toBe(BUCKET_COUNT * MAX_KITS);
    expect(readKits(everything, mulberry32(9)).candidates).toHaveLength(BUCKET_COUNT);
  });

  it('still lets a wasteful grid win, which is what the score is for', () => {
    // A sound loading spread across ten kits: the extra five carry no information,
    // the visitor wins anyway, and the board is what ranks them behind a five-kit
    // win. Nothing about being lavish is punished by the machine itself.
    const lavish = binaryLoading();
    expect(isDistinct(lavish)).toBe(true);
    expect(readKits(lavish, mulberry32(2)).candidates).toHaveLength(1);
    expect(samplesLoaded(lavish, MAX_KITS)).toBe(samplesLoaded(lavish, KITS_NEEDED));
  });
});
