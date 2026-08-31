import { describe, expect, it } from 'vitest';
import { blank, withCell } from './grid.ts';
import { ROUNDS, buildPuzzle } from './rounds.ts';
import {
  type RoundOutcome,
  type Standing,
  compareStandings,
  differences,
  isSolved,
  isWellFormed,
  rank,
  tally,
} from './score.ts';

const outcome = (over: Partial<RoundOutcome> = {}): RoundOutcome => ({
  roundId: 'r1',
  solved: true,
  messages: 2,
  elapsedMs: 60_000,
  counts: true,
  additiveOnly: false,
  ...over,
});

const standing = (over: Partial<Standing> = {}): Standing => ({
  teamId: 't',
  name: 'TEAM',
  solved: 0,
  messages: 0,
  elapsedMs: 0,
  ...over,
});

describe('a submission is right or it is not', () => {
  const spec = ROUNDS[1];
  if (spec === undefined) throw new Error('missing round');
  const { grid } = buildPuzzle(spec, 'seed');

  it('accepts only the picture itself', () => {
    expect(isSolved(grid, grid)).toBe(true);
    expect(isSolved(grid, null)).toBe(false);
    expect(isSolved(grid, blank(spec.size))).toBe(false);
  });

  it('rejects a drawing that is one cell out', () => {
    const nearly = withCell(grid, grid.indexOf('1'), '0');
    expect(isSolved(grid, nearly)).toBe(false);
    expect(differences(grid, nearly)).toHaveLength(1);
  });

  /**
   * There is no partial credit, so the degenerate submissions a percentage would have
   * had to defend against simply have nothing to gain — but the editor refuses to draw
   * them anyway, and the scorer refuses to accept them.
   */
  it('refuses drawings that are not legal snakes', () => {
    expect(isWellFormed(spec.size, grid)).toBe(true);
    expect(isWellFormed(spec.size, blank(spec.size))).toBe(true);
    expect(isWellFormed(spec.size, '1'.repeat(spec.size.w * spec.size.h))).toBe(false);
    expect(isWellFormed(spec.size, '11')).toBe(false);

    // Two separate snakes are not a snake.
    const split = withCell(withCell(blank(spec.size), 0, '1'), 2, '1');
    expect(isWellFormed(spec.size, split)).toBe(false);
  });
});

describe('the ranking', () => {
  it('puts rounds solved first, then messages, then the clock', () => {
    const board = rank([
      standing({ name: 'SLOW', solved: 3, messages: 12, elapsedMs: 900 }),
      standing({ name: 'TIGHT', solved: 3, messages: 8, elapsedMs: 999 }),
      standing({ name: 'MOST', solved: 4, messages: 40, elapsedMs: 999 }),
      standing({ name: 'QUICK', solved: 3, messages: 8, elapsedMs: 100 }),
    ]);
    expect(board.map((s) => s.name)).toEqual(['MOST', 'QUICK', 'TIGHT', 'SLOW']);
  });

  /**
   * The game is about messages, so a team that solved the same rounds with fewer of them
   * wins — being quick about it does not buy a place back.
   */
  it('prefers fewer messages to a faster finish', () => {
    const tight = standing({ solved: 2, messages: 5, elapsedMs: 600_000 });
    const fast = standing({ solved: 2, messages: 6, elapsedMs: 1_000 });
    expect(compareStandings(tight, fast)).toBeLessThan(0);
  });

  it('leaves the warm-up round off the record entirely', () => {
    const total = tally('t', 'TEAM', [
      outcome({ roundId: 'r0', counts: false, messages: 9, solved: true }),
      outcome({ roundId: 'r1', messages: 2 }),
    ]);
    expect(total.solved).toBe(1);
    expect(total.messages).toBe(2);
  });

  /**
   * The lossy round can win a team a place but never cost them one: solving it counts,
   * the messages the channel made them spend do not.
   */
  it('counts a solve on the lossy round but not its messages', () => {
    const total = tally('t', 'TEAM', [
      outcome({ roundId: 'r1', messages: 2 }),
      outcome({ roundId: 'r5', messages: 9, additiveOnly: true, elapsedMs: 240_000 }),
    ]);
    expect(total.solved).toBe(2);
    expect(total.messages).toBe(2);
    expect(total.elapsedMs).toBe(60_000);
  });
});
