import { describe, expect, it } from 'vitest';
import {
  BUG_FIRST,
  BUG_STEP,
  COMPLEXITY_POINTS,
  bugPoints,
  bugRung,
  compareStandings,
  maxPoints,
  rank,
  tally,
  verdictPoints,
  type QuestionOutcome,
  type Standing,
} from './score.ts';

const outcome = (over: Partial<QuestionOutcome> = {}): QuestionOutcome => ({
  questionId: 'q1',
  points: 0,
  complexityCorrect: false,
  bugsFound: 0,
  elapsedMs: 0,
  counts: true,
  ...over,
});

describe('the bug ladder', () => {
  it('rises by a fixed step', () => {
    expect(bugRung(1)).toBe(BUG_FIRST);
    expect(bugRung(2)).toBe(BUG_FIRST + BUG_STEP);
    expect(bugRung(3)).toBe(BUG_FIRST + 2 * BUG_STEP);
    expect(bugRung(0)).toBe(0);
  });

  /**
   * The property the ladder exists for. Nobody is told how many bugs there are, so the
   * answer to "shall we keep looking?" has to always be yes — which means the *next* bug is
   * always worth more than the one before, and one team finding three must beat three teams
   * finding one each.
   */
  it('makes every further bug worth more than the last', () => {
    for (let n = 2; n <= 6; n += 1) {
      expect(bugRung(n)).toBeGreaterThan(bugRung(n - 1));
    }
    expect(bugPoints(3)).toBeGreaterThan(3 * bugPoints(1));
  });

  it('adds the rungs up', () => {
    expect(bugPoints(0)).toBe(0);
    expect(bugPoints(2)).toBe(bugRung(1) + bugRung(2));
  });
});

describe('what a verdict is worth', () => {
  it('pays for the complexity and for each bug', () => {
    expect(verdictPoints(false, 0)).toBe(0);
    expect(verdictPoints(true, 0)).toBe(COMPLEXITY_POINTS);
    expect(verdictPoints(false, 2)).toBe(bugPoints(2));
    expect(verdictPoints(true, 3)).toBe(COMPLEXITY_POINTS + bugPoints(3));
    expect(maxPoints(3)).toBe(verdictPoints(true, 3));
  });

  /**
   * The floor that keeps a struggling team in the game: getting only ever the complexity
   * still scores on every question. And the ordering we want above it: a team that only ever
   * finds bugs beats one that only ever gets the complexity.
   */
  it('puts finding two bugs ahead of getting the complexity', () => {
    expect(verdictPoints(false, 2)).toBeGreaterThan(verdictPoints(true, 0));
  });
});

describe('the board', () => {
  it('leaves the warm-up off the record entirely', () => {
    const total = tally('t', 'TEAM', [
      outcome({ questionId: 'q0', points: 999, complexityCorrect: true, bugsFound: 3, counts: false }),
      outcome({ points: 100, complexityCorrect: true, elapsedMs: 5_000 }),
    ]);
    expect(total.points).toBe(100);
    expect(total.complexities).toBe(1);
    expect(total.bugs).toBe(0);
    expect(total.elapsedMs).toBe(5_000);
  });

  it('ranks on points, then on the clock, then on the name', () => {
    const row = (over: Partial<Standing>): Standing => ({
      teamId: over.name ?? 'x',
      name: 'X',
      points: 0,
      complexities: 0,
      bugs: 0,
      elapsedMs: 0,
      ...over,
    });

    const ordered = rank([
      row({ name: 'SLOW', points: 300, elapsedMs: 90_000 }),
      row({ name: 'QUICK', points: 300, elapsedMs: 10_000 }),
      row({ name: 'BEST', points: 400, elapsedMs: 99_000 }),
      row({ name: 'AARDVARK', points: 300, elapsedMs: 10_000 }),
    ]);

    expect(ordered.map((s) => s.name)).toEqual(['BEST', 'AARDVARK', 'QUICK', 'SLOW']);
  });

  it('is a total order, so the board never shuffles between renders', () => {
    const a: Standing = {
      teamId: 'a',
      name: 'A',
      points: 10,
      complexities: 1,
      bugs: 0,
      elapsedMs: 0,
    };
    expect(compareStandings(a, { ...a, teamId: 'b' })).toBe(0);
    expect(compareStandings(a, { ...a, points: 20 })).toBeGreaterThan(0);
    expect(compareStandings({ ...a, points: 20 }, a)).toBeLessThan(0);
  });
});
