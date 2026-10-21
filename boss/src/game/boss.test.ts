import { describe, expect, it } from 'vitest';
import {
  bestHit,
  classify,
  isLosing,
  isWinningHit,
  legalHits,
  tierOf,
  v2,
  winningHits,
  type Position,
  type Rng,
  type Table,
} from './boss';
import { LEVEL_LIMITS, LEVELS, openingsFor, type Opening } from './levels';

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
 * Ground truth by exhaustive search over (health, forbidden), deliberately independent
 * of the classification. If this and `classify` ever disagree, the theory the levels
 * rest on is wrong.
 */
function searcher(m: number) {
  const memo = new Map<string, boolean>();
  const moverWins = (p: Position): boolean => {
    if (p.health <= 0) return false;
    const key = `${p.health},${p.forbidden}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let result = false;
    for (const hit of legalHits(m, p)) {
      if (!moverWins({ health: p.health - hit, forbidden: hit })) {
        result = true;
        break;
      }
    }
    memo.set(key, result);
    return result;
  };
  return moverWins;
}

type Player = (table: Table, p: Position) => number;

/** Returns 0 if the player who hit first won, 1 otherwise. */
function playOut(opening: Opening, players: [Player, Player]): 0 | 1 {
  const table = classify(opening.m, opening.health);
  let p: Position = { health: opening.health, forbidden: 0 };
  let turn: 0 | 1 = 0;
  for (let guard = 0; guard < 10_000; guard += 1) {
    const hit = players[turn](table, p);
    p = { health: p.health - hit, forbidden: hit };
    if (p.health <= 0) return turn;
    turn = turn === 0 ? 1 : 0;
  }
  throw new Error('playOut did not finish');
}

const perfect =
  (rng: Rng): Player =>
  (table, p) => {
    const hit = bestHit(table, p, rng);
    if (hit === null) throw new Error('no hit from a live position');
    return hit;
  };

const randomPlayer =
  (rng: Rng): Player =>
  (table, p) => {
    const hits = legalHits(table.m, p);
    const hit = hits[Math.floor(rng() * hits.length)];
    if (hit === undefined) throw new Error('no legal hits');
    return hit;
  };

describe('primitives', () => {
  it('lists every amount except the forbidden one', () => {
    expect(legalHits(5, { health: 20, forbidden: 0 })).toEqual([1, 2, 3, 4, 5]);
    expect(legalHits(5, { health: 20, forbidden: 3 })).toEqual([1, 2, 4, 5]);
  });

  it('counts factors of two', () => {
    expect(v2(1)).toBe(0);
    expect(v2(12)).toBe(2);
    expect(v2(16)).toBe(4);
    expect(() => v2(0)).toThrow();
  });

  it('sorts damage limits into levels', () => {
    expect(tierOf(4)).toBe('easy');
    expect(tierOf(10)).toBe('easy');
    expect(tierOf(3)).toBe('medium'); // m + 1 = 4 = 2^2
    expect(tierOf(15)).toBe('medium'); // 16 = 2^4
    expect(tierOf(7)).toBe('hard'); // 8 = 2^3
    expect(tierOf(9)).toBe('hard'); // 10 = 2 * 5
  });
});

describe('the classification', () => {
  it('matches exhaustive search for every m up to 12 and every health up to 60', () => {
    for (let m = 2; m <= 12; m += 1) {
      const table = classify(m, 60);
      const moverWins = searcher(m);
      for (let health = 1; health <= 60; health += 1) {
        for (let forbidden = 0; forbidden <= m; forbidden += 1) {
          const p = { health, forbidden };
          expect(isLosing(table, p), `m=${m} ${health},${forbidden}`).toBe(!moverWins(p));
        }
      }
    }
  });

  it('marks a hit winning exactly when it leaves the opponent lost', () => {
    for (let m = 2; m <= 8; m += 1) {
      const table = classify(m, 40);
      const moverWins = searcher(m);
      for (let health = 1; health <= 40; health += 1) {
        for (let forbidden = 0; forbidden <= m; forbidden += 1) {
          const p = { health, forbidden };
          for (const hit of legalHits(m, p)) {
            const left = { health: health - hit, forbidden: hit };
            expect(isWinningHit(table, p, hit)).toBe(!moverWins(left));
          }
          expect(winningHits(table, p).length > 0).toBe(moverWins(p));
        }
      }
    }
  });

  it('treats a finished boss as lost for whoever is to move', () => {
    const table = classify(4, 10);
    expect(isLosing(table, { health: 0, forbidden: 0 })).toBe(true);
    expect(isLosing(table, { health: -3, forbidden: 2 })).toBe(true);
  });
});

describe('the level rule', () => {
  it('puts the losing health values on the multiples of m + 1 exactly when m + 1 has an even number of factors of 2', () => {
    for (let m = 2; m <= 61; m += 1) {
      const top = 60 * (m + 1);
      const table = classify(m, top);
      let onMultiples = true;
      for (let health = 1; health <= top; health += 1) {
        if ((table.kind[health] === 'evil') !== (health % (m + 1) === 0)) {
          onMultiples = false;
          break;
        }
      }
      expect(onMultiples, `m=${m}`).toBe(v2(m + 1) % 2 === 0);
    }
  });

  it('spaces losing health values m + 1 or m + 2 apart on every level', () => {
    for (let m = 2; m <= 31; m += 1) {
      const top = 40 * (m + 1);
      const table = classify(m, top);
      let last = 0;
      for (let health = 1; health <= top; health += 1) {
        if (table.kind[health] !== 'evil') continue;
        const gap = health - last;
        expect(gap === m + 1 || gap === m + 2, `m=${m} at ${health}`).toBe(true);
        last = health;
      }
    }
  });

  it('keeps every pool on its own level', () => {
    for (const level of LEVELS) {
      for (const m of LEVEL_LIMITS[level]) expect(tierOf(m)).toBe(level);
    }
  });
});

describe('the bot', () => {
  const rng = mulberry32(1);

  it('returns null only when the boss is already down', () => {
    const table = classify(5, 20);
    expect(bestHit(table, { health: 0, forbidden: 0 }, rng)).toBeNull();
    expect(bestHit(table, { health: 1, forbidden: 0 }, rng)).not.toBeNull();
  });

  it('finishes the boss whenever it can', () => {
    const table = classify(6, 30);
    for (let health = 1; health <= 6; health += 1) {
      for (let forbidden = 0; forbidden <= 6; forbidden += 1) {
        const finishing = legalHits(6, { health, forbidden }).filter((h) => h >= health);
        if (finishing.length === 0) continue;
        const hit = bestHit(table, { health, forbidden }, rng);
        expect(hit).not.toBeNull();
        expect((hit as number) >= health).toBe(true);
      }
    }
  });

  it('always plays a legal hit, and never gives up a won position', () => {
    for (let m = 2; m <= 13; m += 1) {
      const table = classify(m, 80);
      for (let health = 1; health <= 80; health += 1) {
        for (let forbidden = 0; forbidden <= m; forbidden += 1) {
          const p = { health, forbidden };
          const hit = bestHit(table, p, rng);
          expect(hit).not.toBeNull();
          expect(legalHits(m, p)).toContain(hit);
          if (!isLosing(table, p)) expect(isWinningHit(table, p, hit as number)).toBe(true);
        }
      }
    }
  });
});

describe('the guarantee', () => {
  it('lets a perfect visitor win every opening on every level', () => {
    const visitor = perfect(mulberry32(11));
    const bot = perfect(mulberry32(23));
    for (const level of LEVELS) {
      for (const opening of openingsFor(level)) {
        expect(playOut(opening, [visitor, bot]), `${level} ${opening.health}/${opening.m}`).toBe(0);
      }
    }
  });

  it('punishes a visitor who guesses, on every level', () => {
    const bot = perfect(mulberry32(31));
    for (const level of LEVELS) {
      let botWins = 0;
      let games = 0;
      for (const opening of openingsFor(level)) {
        for (let seed = 0; seed < 10; seed += 1) {
          games += 1;
          if (playOut(opening, [randomPlayer(mulberry32(seed)), bot]) === 1) botWins += 1;
        }
      }
      expect(botWins / games, level).toBeGreaterThan(0.8);
    }
  });
});
