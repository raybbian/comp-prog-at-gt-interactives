/**
 * Scoring, and the ranking it feeds.
 *
 * A submission is right or it is not. There is no accuracy percentage and no partial
 * credit, which sounds harsh until you notice what replaces it: both halves of a team
 * can read the full log of what they sent *and* what arrived, so every failure is
 * diagnosable without either of them seeing the other's screen. Partial credit exists
 * to soften a puzzle you cannot debug; this one you can.
 *
 * Exact-match also makes unlimited free resubmission safe. A percentage would be a
 * gradient to climb — submit, nudge a cell, watch the number move — but one bit of
 * "not yet" tells you nothing about which cell is wrong, and nobody is searching a
 * thirty-six bit space by hand in four minutes.
 *
 * Ranking is rounds solved, then messages spent, then time taken. Messages are the
 * point of the game, so they rank ahead of the clock; the clock is a cutoff and a
 * tie-break, not a thing to optimise.
 */

import type { Grid, Size } from './grid.ts';
import { bodyCells } from './grid.ts';
import { isInducedPath, orderPath } from './paths.ts';

export type Submission = {
  readonly grid: Grid;
  readonly at: number;
};

/**
 * A drawing the game will accept: right length, and a legal snake.
 *
 * The editor already refuses to draw anything else, so this is a backstop against a
 * hand-made request rather than a thing players will meet. It is also what keeps
 * exact-match honest — a blank grid and a filled-in grid are both simply wrong, so
 * there is no degenerate submission worth trying.
 */
export function isWellFormed(size: Size, grid: Grid): boolean {
  if (grid.length !== size.w * size.h) return false;
  const cells = bodyCells(grid);
  if (cells.length === 0) return true;
  const path = orderPath(size, cells);
  return path !== null && isInducedPath(size, path);
}

export function isSolved(target: Grid, submitted: Grid | null): boolean {
  return submitted !== null && submitted === target;
}

/** Cells that differ, for the post-round reveal. Never shown while a round is live. */
export function differences(target: Grid, submitted: Grid): number[] {
  const out: number[] = [];
  for (let i = 0; i < target.length; i += 1) {
    if (target[i] !== submitted[i]) out.push(i);
  }
  return out;
}

export type RoundOutcome = {
  readonly roundId: string;
  readonly solved: boolean;
  /** Both directions, dropped messages included. */
  readonly messages: number;
  readonly elapsedMs: number;
  /** The warm-up is off the record entirely: nobody is ranked on learning the UI. */
  readonly counts: boolean;
  /**
   * The lossy round can win you a place but never cost you one — solving it counts,
   * the messages it took do not. Every team loses the same *number* of messages there,
   * but not the same ones, and a team should not slide down the board because the
   * channel ate the one message that mattered. Flip this to `false` in `rounds.ts` to
   * put its message count on the board with the rest.
   */
  readonly additiveOnly: boolean;
};

export type Standing = {
  readonly teamId: string;
  readonly name: string;
  readonly solved: number;
  readonly messages: number;
  readonly elapsedMs: number;
};

export function tally(teamId: string, name: string, outcomes: readonly RoundOutcome[]): Standing {
  let solved = 0;
  let messages = 0;
  let elapsedMs = 0;
  for (const outcome of outcomes) {
    if (!outcome.counts) continue;
    if (outcome.solved) solved += 1;
    if (outcome.additiveOnly) continue;
    messages += outcome.messages;
    elapsedMs += outcome.elapsedMs;
  }
  return { teamId, name, solved, messages, elapsedMs };
}

/**
 * Most rounds solved wins. Among teams level on rounds, fewest messages wins, because
 * that is the thing the game is actually about. Time only separates teams level on
 * both.
 */
export function compareStandings(a: Standing, b: Standing): number {
  if (a.solved !== b.solved) return b.solved - a.solved;
  if (a.messages !== b.messages) return a.messages - b.messages;
  if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
  return a.name.localeCompare(b.name);
}

export function rank(standings: readonly Standing[]): Standing[] {
  return standings.slice().sort(compareStandings);
}
