/**
 * Points, and the ranking they feed.
 *
 * **The model decides what a team identified; this file decides what it is worth.** The
 * grader returns a boolean and a list of bug ids and nothing else — never a score — so
 * the arithmetic on the board is ordinary code with tests, and a team asking "how did we
 * get 230" gets an answer that does not depend on what a language model felt like. It
 * also means a regrade cannot quietly change the scale.
 *
 * The bug ladder rises: the first bug you find is worth 50, the second 80, the third 110.
 * That is not a flourish. **The number of bugs is never announced**, so a team can never
 * know whether they are done, and a rising ladder is what makes the answer to "shall we
 * keep looking?" always yes. It also puts the reward where the difficulty is — the third
 * bug in a snippet is the one nobody else found, and three teams finding one bug each
 * should not add up to the team that found all three.
 *
 * Complexity is worth one flat 100, because it is one question with one answer. A team
 * that only ever gets the complexity right still scores on every question, which is the
 * floor that keeps a struggling team in the game; a team that only ever finds bugs beats
 * them, which is the ordering we want.
 */

export const COMPLEXITY_POINTS = 100;
/** The first bug found, and how much more each one after it is worth. */
export const BUG_FIRST = 50;
export const BUG_STEP = 30;

/** What the `n`th bug found is worth on its own, one-indexed. For the briefing slide. */
export function bugRung(n: number): number {
  return n < 1 ? 0 : BUG_FIRST + BUG_STEP * (n - 1);
}

/** What `found` bugs are worth in total. */
export function bugPoints(found: number): number {
  let total = 0;
  for (let n = 1; n <= found; n += 1) total += bugRung(n);
  return total;
}

export function verdictPoints(complexityCorrect: boolean, bugsFound: number): number {
  return (complexityCorrect ? COMPLEXITY_POINTS : 0) + bugPoints(bugsFound);
}

/** The most a question can be worth, for the projector's "230 / 340". */
export function maxPoints(bugCount: number): number {
  return verdictPoints(true, bugCount);
}

export type QuestionOutcome = {
  readonly questionId: string;
  readonly points: number;
  readonly complexityCorrect: boolean;
  readonly bugsFound: number;
  /** Time from the question opening to the submission that counted. */
  readonly elapsedMs: number;
  /** The warm-up is off the record entirely. */
  readonly counts: boolean;
};

export type Standing = {
  readonly teamId: string;
  readonly name: string;
  readonly points: number;
  readonly complexities: number;
  readonly bugs: number;
  readonly elapsedMs: number;
};

export function tally(
  teamId: string,
  name: string,
  outcomes: readonly QuestionOutcome[],
): Standing {
  let points = 0;
  let complexities = 0;
  let bugs = 0;
  let elapsedMs = 0;
  for (const outcome of outcomes) {
    if (!outcome.counts) continue;
    points += outcome.points;
    if (outcome.complexityCorrect) complexities += 1;
    bugs += outcome.bugsFound;
    elapsedMs += outcome.elapsedMs;
  }
  return { teamId, name, points, complexities, bugs, elapsedMs };
}

/**
 * Points, then the clock.
 *
 * The clock is a tie-break and nothing more — this half of the evening is about reading
 * code, not racing, and a team that spends its whole four minutes and gets everything
 * should beat one that answers in thirty seconds and misses a bug. It only separates
 * teams that are otherwise exactly level, which at six questions does happen.
 */
export function compareStandings(a: Standing, b: Standing): number {
  if (a.points !== b.points) return b.points - a.points;
  if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
  return a.name.localeCompare(b.name);
}

export function rank(standings: readonly Standing[]): Standing[] {
  return standings.slice().sort(compareStandings);
}
