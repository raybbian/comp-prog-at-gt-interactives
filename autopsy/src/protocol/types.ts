/**
 * Everything that crosses the wire.
 *
 * Two rules hold throughout.
 *
 * **`| null`, never `?`.** `JSON.stringify` drops keys whose value is `undefined`, so an
 * optional property does not survive a round trip — and under `exactOptionalPropertyTypes`
 * the type you get back is not the type you sent. Optionality lives in the value.
 *
 * **Redaction is a type, not a filter.** `PlayerView` has no field the answer key could
 * occupy while a question is open: the correct complexity and the bug list arrive inside
 * a `Reveal`, which the server only ever builds once the question is closed. A team with
 * devtools open reads every byte we send them, so the only defence that holds is one
 * where leaking is a compile error rather than a review someone has to remember to do.
 * `game.test.ts` stringifies the player view at every phase and asserts no bug summary
 * is in there, in case a future field smuggles one out.
 */

import type { Language } from './questions.ts';

/**
 * A question walks: the clock runs, the grader works, the answer goes up. `lobby` is
 * before anything starts and `done` is after the last reveal.
 *
 * `grading` is a phase rather than a spinner bolted onto `reveal` because it is a real
 * state the room can see: twenty answers are with a language model and the standings are
 * about to move. Hiding that would make the board look frozen at the one moment everyone
 * is watching it.
 */
export type Phase = 'lobby' | 'play' | 'grading' | 'reveal' | 'done';

/** What a question tells the players. Notably absent: anything about the answer. */
export type PublicQuestion = {
  readonly id: string;
  readonly index: number;
  readonly total: number;
  readonly language: Language;
  readonly intent: string;
  readonly code: string;
  readonly phase: Phase;
  readonly phaseEndsAt: number | null;
  /** False on the warm-up, which is off the record. */
  readonly counts: boolean;
};

/** One bug, as the reveal presents it. */
export type RevealedBug = {
  readonly id: string;
  readonly summary: string;
  readonly detail: string;
  /** How many teams identified it — the most interesting column on the projector. */
  readonly foundBy: number;
  /** Whether this team got it. Always false in the host's copy, which has no team. */
  readonly yours: boolean;
};

export type Reveal = {
  readonly complexity: string;
  readonly complexityNote: string;
  readonly bugs: readonly RevealedBug[];
  readonly teamsAnswered: number;
  readonly teamCount: number;
  readonly complexityFoundBy: number;
};

/** The grader's verdict on one team's answer, as that team sees it. */
export type Verdict = {
  /** `graded` is the normal case; `empty` never reached the grader; `failed` may retry. */
  readonly status: 'graded' | 'empty' | 'failed';
  readonly complexityCorrect: boolean;
  readonly bugIds: readonly string[];
  /** One line from the grader, for the team to read at the reveal. */
  readonly note: string;
  readonly points: number;
};

export type TeamAnswer = {
  readonly complexity: string;
  readonly findings: string;
  readonly submittedAt: number | null;
  /** Which phone on the team sent the one that counts. */
  readonly submittedBy: string | null;
};

export type StandingRow = {
  readonly teamId: string;
  readonly name: string;
  readonly rank: number;
  readonly points: number;
  readonly complexities: number;
  readonly bugs: number;
};

export type TeamPublic = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly memberCount: number;
};

/**
 * What one phone sees.
 *
 * `answer` is the *team's* answer, not this phone's draft. Four people round one snippet
 * all see the same submitted text and who sent it, which is the only arrangement that
 * makes "last submission counts" safe to stand next to: overwriting someone is possible,
 * and visible.
 */
export type PlayerView = {
  readonly kind: 'player';
  readonly v: number;
  readonly serverTime: number;
  readonly team: TeamPublic;
  /** `1`, `2`, … — which phone on the team this is. Nobody types a name twice. */
  readonly seat: string;
  readonly question: PublicQuestion | null;
  readonly answer: TeamAnswer | null;
  readonly verdict: Verdict | null;
  readonly reveal: Reveal | null;
  readonly standing: StandingRow | null;
  readonly standings: readonly StandingRow[];
};

/**
 * Notably absent: the team's join code. The board is unauthenticated and on a wall, and a
 * list of every team's code published to the room would only tell forty strangers how to
 * walk into each other's teams. A code is read off the phone of whoever made the team, by
 * the people sitting beside them, and that phone shows it whenever the team is short.
 */
export type HostTeamRow = {
  readonly teamId: string;
  readonly name: string;
  readonly memberCount: number;
  /** `waiting` | `reading` | `answered` | `graded` — shape on the board, never colour. */
  readonly activity: 'waiting' | 'reading' | 'answered' | 'graded';
  readonly pointsThisQuestion: number | null;
};

export type HostView = {
  readonly kind: 'host';
  readonly v: number;
  readonly serverTime: number;
  readonly joinUrl: string;
  /** The six digits the room types in. This board is the only place they are published. */
  readonly room: string;
  readonly question: PublicQuestion | null;
  /** Only at the reveal. A projector must not hold the key while the room is reading. */
  readonly reveal: Reveal | null;
  readonly teams: readonly HostTeamRow[];
  readonly standings: readonly StandingRow[];
  readonly answeredCount: number;
  readonly teamCount: number;
  readonly memberCount: number;
  /** Ungraded answers still owed a verdict, and how many gave up. */
  readonly pendingGrades: number;
  readonly failedGrades: number;
  /**
   * Why the last failure failed, host-only and untruncated enough to act on. "invalid
   * x-api-key" is a different evening from "rate limited", and a count of three tells you
   * neither. Never sent to a team: a grader's excuses are not part of the game.
   */
  readonly lastGradeError: string | null;
  /**
   * Whether the grader has an API key at all. On the footer from the moment the board
   * opens, so "the scores never moved" is discovered before the room arrives.
   */
  readonly graderReady: boolean;
};

export type AnyView = PlayerView | HostView;

/** What the pre-join splash needs, with no session at all. */
export type Lobby = {
  readonly kind: 'lobby';
  readonly serverTime: number;
  readonly room: string;
  readonly phase: Phase;
  readonly teamCount: number;
  readonly joinOpen: boolean;
};
