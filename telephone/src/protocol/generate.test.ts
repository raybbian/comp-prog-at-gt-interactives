import { describe, expect, it } from 'vitest';
import { bodyCells } from './grid.ts';
import { generateRamp } from './generate.ts';
import { isInducedPath, orderPath } from './paths.ts';
import { RAMP_LEVELS, ROUNDS, buildPuzzle } from './rounds.ts';
import { rngFrom } from './rng.ts';

const SEEDS = Array.from({ length: 60 }, (_, i) => `seed-${i}`);

describe('puzzle generation', () => {
  for (const spec of ROUNDS) {
    describe(spec.id, () => {
      it('always produces a legal induced snake', () => {
        for (const seed of SEEDS) {
          const { path } = buildPuzzle(spec, seed);
          expect(isInducedPath(spec.size, path), `${spec.id} ${seed}`).toBe(true);
        }
      });

      it('is deterministic in the seed', () => {
        for (const seed of SEEDS.slice(0, 10)) {
          expect(buildPuzzle(spec, seed).grid).toBe(buildPuzzle(spec, seed).grid);
        }
      });

      it('fills the grid with the levels the round declares', () => {
        for (const seed of SEEDS.slice(0, 10)) {
          const { grid, path } = buildPuzzle(spec, seed);
          expect(grid.length).toBe(spec.size.w * spec.size.h);
          expect(bodyCells(grid).length).toBe(path.length);
          for (const cell of grid) {
            expect(Number(cell)).toBeLessThanOrEqual(spec.levels);
          }
        }
      });

      /**
       * The receiver on a shape-given round is handed the snake to fill in, and the
       * post-round reveal walks the body in order. Both rely on the order being
       * recoverable from the cells alone, which is a property the induced rule buys.
       */
      it('has an unambiguous traversal order', () => {
        for (const seed of SEEDS.slice(0, 20)) {
          const { grid, path } = buildPuzzle(spec, seed);
          const recovered = orderPath(spec.size, bodyCells(grid));
          expect(recovered).not.toBeNull();
          const forward = recovered as number[];
          const matches =
            forward.join(',') === path.join(',') ||
            forward.slice().reverse().join(',') === path.join(',');
          expect(matches, `${spec.id} ${seed}`).toBe(true);
        }
      });
    });
  }

  it('gives the warm-up round a snake with no turns in it', () => {
    const spec = ROUNDS[0];
    if (spec === undefined) throw new Error('missing warm-up round');
    for (const seed of SEEDS) {
      const { path } = buildPuzzle(spec, seed);
      const rows = new Set(path.map((c) => Math.floor(c / spec.size.w)));
      const cols = new Set(path.map((c) => c % spec.size.w));
      expect(rows.size === 1 || cols.size === 1, seed).toBe(true);
    }
  });

  it('keeps the straightaway round made of long runs', () => {
    // Found by shape rather than by index, and the floor is read off the shape itself —
    // this round has moved once already and the assertion should move with it.
    const spec = ROUNDS.find((r) => r.shape.kind === 'rectilinear');
    if (spec === undefined || spec.shape.kind !== 'rectilinear') {
      throw new Error('missing straightaway round');
    }
    const floor = spec.shape.segments * spec.shape.minRun;
    for (const seed of SEEDS.slice(0, 20)) {
      const { path } = buildPuzzle(spec, seed);
      expect(path.length, seed).toBeGreaterThanOrEqual(floor);
    }
  });
});

describe('the colour ramp', () => {
  it('never steps by more than one level', () => {
    for (const seed of SEEDS) {
      const levels = generateRamp(rngFrom(seed), 200, RAMP_LEVELS);
      for (let i = 1; i < levels.length; i += 1) {
        const previous = levels[i - 1] as number;
        const current = levels[i] as number;
        expect(Math.abs(current - previous), seed).toBeLessThanOrEqual(1);
        expect(current).toBeGreaterThanOrEqual(1);
        expect(current).toBeLessThanOrEqual(RAMP_LEVELS);
      }
    }
  });

  /**
   * The round only teaches what it is meant to teach if run-length encoding loses. Runs
   * average about one and a half cells, so a (value, length) pair per run costs more
   * than simply writing the levels out — which is the number that goes on the projector.
   */
  it('leaves runs too short for run-length encoding to pay', () => {
    let cells = 0;
    let runs = 0;
    for (const seed of SEEDS) {
      const levels = generateRamp(rngFrom(seed), 200, RAMP_LEVELS);
      cells += levels.length;
      runs += levels.filter((v, i) => i === 0 || v !== levels[i - 1]).length;
    }
    const meanRun = cells / runs;
    expect(meanRun).toBeLessThan(2);
  });
});
