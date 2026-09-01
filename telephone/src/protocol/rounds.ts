/**
 * The round table.
 *
 * Six rounds, each with a different cheapest encoding, ordered so that the trick that
 * won the last round is never quite the trick that wins the next one. No round announces
 * a target message count: a number on the projector tells a team when to stop thinking,
 * and the whole point is that there is always something better than what you have.
 *
 * Rounds are numbered on screen and never named, for the same reason the Stone Game is
 * never called Nim: a name is a search term, and the search would hand over the answer.
 */

import { type Grid, type Size, paint } from './grid.ts';
import {
  generateInduced,
  generateRamp,
  generateRectilinear,
  generateStraight,
} from './generate.ts';
import type { CellIndex } from './grid.ts';
import { rngFrom } from './rng.ts';

/** Digits 0-9, and the cap that makes the whole thing a puzzle. */
export const MAX_DIGITS = 8;

/** Levels a body cell can take on the coloured round. '0' is reserved for empty. */
export const RAMP_LEVELS = 9;

export type Shape =
  | { readonly kind: 'straight'; readonly minLength: number; readonly maxLength: number }
  | { readonly kind: 'induced'; readonly length: number }
  | {
      readonly kind: 'rectilinear';
      readonly segments: number;
      readonly minRun: number;
      readonly maxRun: number;
    };

export type RoundSpec = {
  readonly id: string;
  readonly index: number;
  readonly size: Size;
  readonly shape: Shape;
  /** 1 for monochrome; RAMP_LEVELS for the coloured round. */
  readonly levels: number;
  /** Whether both players are shown the shape, leaving only the colours to send. */
  readonly shapeGiven: boolean;
  /** Fraction of messages the channel silently swallows. */
  readonly dropRate: number;
  /** Protocol time before the clock starts, and the round itself. */
  readonly briefMs: number;
  readonly playMs: number;
  /** A warm-up round the host declares off the record. */
  readonly counts: boolean;
  /** Can only add to a team's total, never cost them a place. */
  readonly additiveOnly: boolean;
  /** One line on the projector. Says what to do, never how. */
  readonly brief: string;
};

const MINUTE = 60_000;

export const ROUNDS: readonly RoundSpec[] = [
  {
    id: 'r0',
    index: 0,
    size: { w: 6, h: 6 },
    shape: { kind: 'straight', minLength: 4, maxLength: 6 },
    // Coloured from the very first round. The palette is half the vocabulary of this
    // game, and meeting it for the first time in round three — with a clock running and
    // a partner waiting — is the wrong moment. Here it costs nothing to get wrong.
    levels: RAMP_LEVELS,
    shapeGiven: false,
    dropRate: 0,
    briefMs: MINUTE,
    playMs: 2 * MINUTE,
    counts: false,
    additiveOnly: false,
    brief: 'A warm-up. Send the line, and its colours.',
  },
  {
    id: 'r1',
    index: 1,
    size: { w: 6, h: 6 },
    shape: { kind: 'induced', length: 12 },
    levels: 1,
    shapeGiven: false,
    dropRate: 0,
    briefMs: 2 * MINUTE,
    playMs: 4 * MINUTE,
    counts: true,
    additiveOnly: false,
    brief: 'Black and white now, but it bends.',
  },
  {
    id: 'r2',
    index: 2,
    size: { w: 8, h: 8 },
    shape: { kind: 'induced', length: 20 },
    levels: 1,
    shapeGiven: false,
    dropRate: 0,
    briefMs: 2 * MINUTE,
    playMs: 5 * MINUTE,
    counts: true,
    additiveOnly: false,
    brief: 'A longer snake on a bigger board.',
  },
  {
    id: 'r3',
    index: 3,
    size: { w: 10, h: 10 },
    shape: { kind: 'induced', length: 30 },
    levels: RAMP_LEVELS,
    shapeGiven: true,
    dropRate: 0,
    briefMs: 2 * MINUTE,
    playMs: 5 * MINUTE,
    counts: true,
    additiveOnly: false,
    brief: 'You both have the shape. Only the colours are missing.',
  },
  {
    id: 'r4',
    index: 4,
    size: { w: 12, h: 12 },
    shape: { kind: 'rectilinear', segments: 6, minRun: 5, maxRun: 12 },
    levels: 1,
    shapeGiven: false,
    dropRate: 0,
    briefMs: 2 * MINUTE,
    playMs: 5 * MINUTE,
    counts: true,
    additiveOnly: false,
    brief: 'Six long straight runs.',
  },
  {
    id: 'r5',
    index: 5,
    size: { w: 8, h: 8 },
    shape: { kind: 'induced', length: 14 },
    levels: 1,
    shapeGiven: false,
    dropRate: 0.2,
    briefMs: 2 * MINUTE,
    playMs: 4 * MINUTE,
    counts: true,
    additiveOnly: true,
    brief: 'One message in five will be lost. You will not be told which.',
  },
];

/**
 * The seed every *example* snake is drawn from.
 *
 * Fixed, and deliberately not the meeting's seed: an example has to be the same picture
 * for both halves of a team and for the projector, while telling nobody anything about the
 * round they are about to play. Because it is the same constant everywhere, the snake a
 * pair plans against during protocol time is the one they were shown at the briefing.
 */
export const SAMPLE_SEED = 'briefing';

export function roundById(id: string): RoundSpec | null {
  return ROUNDS.find((r) => r.id === id) ?? null;
}

export type Puzzle = {
  readonly path: readonly CellIndex[];
  readonly levels: readonly number[];
  readonly grid: Grid;
};

/**
 * The picture for one round of one meeting. Every team gets the same seed, so the
 * leaderboard compares like with like, and a round can be regenerated afterwards from
 * `(spec.id, seed)` alone.
 */
/** The example for a round: same for both players, and never the picture they are sent. */
export function sampleFor(spec: RoundSpec): Puzzle {
  return buildPuzzle(spec, SAMPLE_SEED);
}

export function buildPuzzle(spec: RoundSpec, seed: string): Puzzle {
  const rng = rngFrom(seed, spec.id);
  const path =
    spec.shape.kind === 'straight'
      ? generateStraight(spec.size, rng, spec.shape.minLength, spec.shape.maxLength)
      : spec.shape.kind === 'induced'
        ? generateInduced(spec.size, rng, spec.shape.length)
        : generateRectilinear(
            spec.size,
            rng,
            spec.shape.segments,
            spec.shape.minRun,
            spec.shape.maxRun,
          );

  const levels =
    spec.levels > 1
      ? generateRamp(rng, path.length, spec.levels)
      : new Array<number>(path.length).fill(1);

  return { path, levels, grid: paint(spec.size, path, levels) };
}
