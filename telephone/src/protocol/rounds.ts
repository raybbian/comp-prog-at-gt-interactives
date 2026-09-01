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
  generateSplotches,
  generateSteps,
  generateVaried,
  generateRectilinear,
  generateStraight,
} from './generate.ts';
import type { CellIndex } from './grid.ts';
import { type Rng, rngFrom } from './rng.ts';

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

/**
 * How the levels along the snake are chosen. Ignored on a round with one level.
 *
 * This is the axis the coloured rounds differ on, and it is what makes each of them a
 * different problem rather than a bigger one: `varied` forces a colour per cell, so a pair
 * must first agree how to say one at all; `splotches` puts the colours in blocks, so the
 * pair who counts blocks beats the pair who did not notice.
 */
export type Colouring =
  | { readonly kind: 'varied' }
  | { readonly kind: 'splotches'; readonly minRun: number; readonly maxRun: number }
  | { readonly kind: 'steps' };

export type RoundSpec = {
  readonly id: string;
  readonly index: number;
  readonly size: Size;
  readonly shape: Shape;
  /** 1 for monochrome; RAMP_LEVELS for a coloured round. */
  readonly levels: number;
  readonly colouring: Colouring;
  /** Whether both players are shown the shape, leaving only the colours to send. */
  readonly shapeGiven: boolean;
  /** Fraction of messages the channel silently swallows. */
  readonly dropRate: number;
  /**
   * What a good encoding costs, in messages. Shown at the reveal and never before it —
   * a number on screen while the clock runs tells a team when to stop thinking, and the
   * same number afterwards tells them there was more to find.
   */
  readonly par: number;
  /** Protocol time before the clock starts, and the round itself. */
  readonly briefMs: number;
  readonly playMs: number;
  /** A warm-up round the host declares off the record. */
  readonly counts: boolean;
  /** Can only add to a team's total, never cost them a place. */
  readonly additiveOnly: boolean;
  /** One line on the projector. Says what to do, never how. */
};

const MINUTE = 60_000;

export const ROUNDS: readonly RoundSpec[] = [
  /*
   * Colour, then shape, then the two together — and each of the last three rounds is a
   * different reason the obvious encoding is not the good one.
   */
  {
    id: 'r0',
    index: 0,
    size: { w: 6, h: 6 },
    // A line, so there is no shape to describe and the colours are the whole message.
    // Meeting the palette for the first time with a clock running and a partner waiting is
    // the wrong moment; here it costs nothing to get wrong.
    shape: { kind: 'straight', minLength: 4, maxLength: 6 },
    levels: RAMP_LEVELS,
    colouring: { kind: 'varied' },
    shapeGiven: false,
    dropRate: 0,
    par: 2,
    briefMs: MINUTE,
    playMs: 2 * MINUTE,
    counts: false,
    additiveOnly: false,
  },
  {
    id: 'r1',
    index: 1,
    size: { w: 8, h: 8 },
    // The mirror of round 0: one colour, so the shape is the whole message. Few enough
    // turns that "go four right, three down" is sayable before anyone is clever.
    shape: { kind: 'rectilinear', segments: 4, minRun: 2, maxRun: 5 },
    levels: 1,
    colouring: { kind: 'varied' },
    shapeGiven: false,
    dropRate: 0,
    par: 2,
    briefMs: 2 * MINUTE,
    playMs: 4 * MINUTE,
    counts: true,
    additiveOnly: false,
  },
  {
    id: 'r2',
    index: 2,
    size: { w: 10, h: 10 },
    // The shape is a gift, so the colours are the entire puzzle — and they arrive in long
    // blocks. A colour per cell costs thirty; counting the blocks costs about twelve.
    shape: { kind: 'induced', length: 30 },
    levels: RAMP_LEVELS,
    colouring: { kind: 'splotches', minRun: 3, maxRun: 8 },
    shapeGiven: true,
    dropRate: 0,
    par: 2,
    briefMs: 2 * MINUTE,
    playMs: 5 * MINUTE,
    counts: true,
    additiveOnly: false,
  },
  {
    id: 'r3',
    index: 3,
    size: { w: 10, h: 10 },
    // The same gift, and the blocks are gone: every step is exactly one level, up or
    // down. So the message is a start value and twenty-nine bits, and the team that sees
    // that packs them into nine digits instead of sending thirty numbers.
    shape: { kind: 'induced', length: 30 },
    levels: RAMP_LEVELS,
    colouring: { kind: 'steps' },
    shapeGiven: true,
    dropRate: 0,
    par: 2,
    briefMs: 2 * MINUTE,
    playMs: 5 * MINUTE,
    counts: true,
    additiveOnly: false,
  },
  {
    id: 'r4',
    index: 4,
    size: { w: 8, h: 8 },
    // Turns everywhere, so describing the walk stops paying and the board itself becomes
    // the cheaper thing to send. Sixty-four cells is not an accident: eight messages of
    // eight binary digits is the whole grid, exactly — and a team that packed bits last
    // round already knows how to do it in three.
    shape: { kind: 'induced', length: 24 },
    levels: 1,
    colouring: { kind: 'varied' },
    shapeGiven: false,
    dropRate: 0,
    par: 3,
    briefMs: 2 * MINUTE,
    playMs: 5 * MINUTE,
    counts: true,
    additiveOnly: false,
  },
  {
    id: 'r5',
    index: 5,
    size: { w: 8, h: 8 },
    // Everything at once, over a channel that eats one message in five and never says
    // which. Shape and colour both, so there is something worth protecting.
    shape: { kind: 'induced', length: 16 },
    levels: RAMP_LEVELS,
    colouring: { kind: 'splotches', minRun: 2, maxRun: 6 },
    shapeGiven: false,
    dropRate: 0.2,
    par: 6,
    briefMs: 2 * MINUTE,
    playMs: 5 * MINUTE,
    counts: true,
    additiveOnly: true,
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

function colourAlong(rng: Rng, length: number, spec: RoundSpec): number[] {
  if (spec.colouring.kind === 'splotches') {
    return generateSplotches(
      rng,
      length,
      spec.levels,
      spec.colouring.minRun,
      spec.colouring.maxRun,
    );
  }
  if (spec.colouring.kind === 'steps') return generateSteps(rng, length, spec.levels);
  return generateVaried(rng, length, spec.levels);
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
    spec.levels > 1 ? colourAlong(rng, path.length, spec) : new Array<number>(path.length).fill(1);

  return { path, levels, grid: paint(spec.size, path, levels) };
}
