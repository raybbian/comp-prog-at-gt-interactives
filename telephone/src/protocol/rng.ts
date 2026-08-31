/**
 * Seeded randomness, shared by the worker and the client.
 *
 * Every puzzle in a round is generated from one broadcast seed, so all twenty teams
 * are looking at the same picture and the leaderboard compares like with like. The
 * briefing screen renders its samples from this same generator, which is why this
 * file has to run in a browser as well as in the worker.
 *
 * Integer arithmetic only — no floats in the state — so a seed produces byte-identical
 * output on every platform, and a round can be reproduced after the fact from its seed
 * alone.
 */

/** FNV-1a over the `|`-joined parts. Cheap, well-mixed enough for puzzle generation. */
export function hash32(...parts: readonly (string | number)[]): number {
  let h = 0x811c9dc5;
  const key = parts.join('|');
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = () => number;

/** mulberry32: one 32-bit word of state, uniform in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFrom(...parts: readonly (string | number)[]): Rng {
  return mulberry32(hash32(...parts));
}

/** Uniform integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher-Yates on a copy. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(rng, i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
