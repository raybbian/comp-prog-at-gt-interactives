import { describe, expect, it } from 'vitest';
import { classify, type Rng } from './boss';
import {
  createDealer,
  LEVEL_LIMITS,
  LEVELS,
  MAX_ROUNDS,
  MIN_ROUNDS,
  openingsFor,
} from './levels';

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

describe('openings', () => {
  it('are winnable for the visitor and sit inside the health window', () => {
    for (const level of LEVELS) {
      const openings = openingsFor(level);
      expect(openings.length).toBeGreaterThan(0);
      for (const { health, m } of openings) {
        expect(LEVEL_LIMITS[level]).toContain(m);
        expect(health).toBeGreaterThanOrEqual(MIN_ROUNDS * (m + 1));
        expect(health).toBeLessThanOrEqual(MAX_ROUNDS * (m + 1));
        expect(classify(m, health).kind[health]).not.toBe('evil');
      }
    }
  });

  it('skip every multiple of m + 1 on Easy and Medium', () => {
    for (const level of ['easy', 'medium'] as const) {
      for (const { health, m } of openingsFor(level)) {
        expect(health % (m + 1)).not.toBe(0);
      }
    }
  });

  it('keep the pad to at most three rows of five', () => {
    for (const level of LEVELS) {
      for (const m of LEVEL_LIMITS[level]) expect(m).toBeLessThanOrEqual(15);
    }
  });
});

describe('the dealer', () => {
  it('deals the whole pool before repeating, and never twice in a row', () => {
    for (const level of LEVELS) {
      const pool = openingsFor(level);
      const deal = createDealer(level, mulberry32(5));
      const first = Array.from({ length: pool.length }, deal);
      expect(new Set(first.map((o) => `${o.health}/${o.m}`)).size).toBe(pool.length);

      const long = Array.from({ length: pool.length * 5 }, deal);
      for (let i = 1; i < long.length; i += 1) {
        expect(long[i]).not.toBe(long[i - 1]);
      }
    }
  });
});
