/**
 * What each session is allowed to know.
 *
 * This is the security-critical file, and the defence is the type system rather than a
 * filter someone has to remember to apply. A team with devtools open reads every byte the
 * server sends them, so `PlayerView` has no field the answer key could occupy: the correct
 * complexity and the bug list only exist inside a `Reveal`, and `revealFor` returns `null`
 * until the question is closed. Getting it wrong is a compile error, not something a
 * reviewer has to catch — and `game.test.ts` stringifies the result at every phase and
 * asserts no bug summary is in there, in case a future field smuggles one out.
 *
 * The host is the other half of that: the projector needs the key at the reveal, so the
 * host view carries it then and never before, because a board that holds the answer while
 * the room is still reading is one stray render away from ending the question.
 *
 * The board is unauthenticated, which is why `HostTeamRow` carries no join code. The only
 * thing a key ever bought was stopping someone in the room from opening the same URL — a
 * social problem — and what a stranger must genuinely not be handed is a live team's code.
 * That is this file's job rather than a gate's.
 */

import { QUESTIONS, type QuestionSpec } from '../src/protocol/questions.ts';
import { rank, tally } from '../src/protocol/score.ts';
import type {
  HostTeamRow,
  HostView,
  PlayerView,
  PublicQuestion,
  Reveal,
  RevealedBug,
  StandingRow,
  TeamAnswer,
  TeamPublic,
  Verdict,
} from '../src/protocol/types.ts';
import { answerFor } from './answers.ts';
import {
  type Meta,
  type State,
  type Team,
  type TeamQuestion,
  currentQuestion,
  hasSubmission,
  memberCount,
} from './state.ts';

function teamPublic(team: Team): TeamPublic {
  return {
    id: team.id,
    name: team.name,
    code: team.code,
    memberCount: team.members.length,
  };
}

function publicQuestion(meta: Meta, question: QuestionSpec): PublicQuestion {
  return {
    id: question.id,
    index: question.index,
    total: QUESTIONS.length,
    language: question.language,
    intent: question.intent,
    code: question.code,
    phase: meta.phase,
    phaseEndsAt: meta.phaseEndsAt,
    counts: question.counts,
  };
}

function answerPublic(play: TeamQuestion | null): TeamAnswer | null {
  if (play === null) return null;
  return {
    complexity: play.complexity,
    findings: play.findings,
    submittedAt: play.submittedAt,
    submittedBy: play.submittedBy,
  };
}

/** Strips `reason` and `gradedAt`: why the grader fell over is the host's problem. */
function verdictPublic(play: TeamQuestion | null): Verdict | null {
  const stored = play?.verdict ?? null;
  if (stored === null) return null;
  return {
    status: stored.status,
    complexityCorrect: stored.complexityCorrect,
    bugIds: stored.bugIds,
    note: stored.note,
    points: stored.points,
  };
}

/**
 * The answer key, once the question is closed.
 *
 * `foundBy` is the column that makes this worth putting on a projector: "two teams of
 * fourteen found the overflow" tells a room something about the bug that the bug itself
 * does not, and it does it without naming anybody.
 */
function revealFor(state: State, question: QuestionSpec, team: Team | null): Reveal | null {
  // `reveal` and `done` only — not `grading`, even though submissions are already closed
  // by then. The host's back key can reopen a question from `grading`, and it is only
  // safe to reopen one nobody has seen the answer to. Once the key is out it is out, which
  // is why `back` from `reveal` goes to the previous question rather than reopening this
  // one.
  if (state.meta.phase !== 'reveal' && state.meta.phase !== 'done') return null;
  const key = answerFor(question.id);
  if (key === null) return null;

  const plays = Object.values(state.teams).map((t) => t.play[question.id] ?? null);
  const graded = plays.filter((p) => p?.verdict?.status === 'graded');
  const mine = team === null ? null : (team.play[question.id] ?? null);

  const bugs: RevealedBug[] = key.bugs.map((bug) => ({
    id: bug.id,
    summary: bug.summary,
    detail: bug.detail,
    foundBy: graded.filter((p) => p?.verdict?.bugIds.includes(bug.id) === true).length,
    yours: mine?.verdict?.bugIds.includes(bug.id) === true,
  }));

  return {
    complexity: key.complexity,
    complexityNote: key.complexityNote,
    bugs,
    teamsAnswered: plays.filter((p) => p !== null && hasSubmission(p)).length,
    teamCount: Object.keys(state.teams).length,
    complexityFoundBy: graded.filter((p) => p?.verdict?.complexityCorrect === true).length,
  };
}

export function standingsOf(state: State): StandingRow[] {
  const totals = Object.values(state.teams).map((team) =>
    tally(
      team.id,
      team.name,
      QUESTIONS.map((question) => {
        const play = team.play[question.id];
        return {
          questionId: question.id,
          points: play?.verdict?.points ?? 0,
          complexityCorrect: play?.verdict?.complexityCorrect ?? false,
          bugsFound: play?.verdict?.bugIds.length ?? 0,
          elapsedMs: play?.elapsedMs ?? 0,
          counts: question.counts,
        };
      }),
    ),
  );
  return rank(totals).map((s, i) => ({
    teamId: s.teamId,
    name: s.name,
    rank: i + 1,
    points: s.points,
    complexities: s.complexities,
    bugs: s.bugs,
  }));
}

export function buildPlayerView(
  state: State,
  team: Team,
  seat: string,
  now: number,
): PlayerView {
  const question = currentQuestion(state.meta);
  const play = question === null ? null : (team.play[question.id] ?? null);
  const standings = standingsOf(state);

  return {
    kind: 'player',
    v: state.meta.v,
    serverTime: now,
    team: teamPublic(team),
    seat,
    question: question === null ? null : publicQuestion(state.meta, question),
    answer: answerPublic(play),
    verdict: verdictPublic(play),
    reveal: question === null ? null : revealFor(state, question, team),
    standing: standings.find((s) => s.teamId === team.id) ?? null,
    // The board is public — it is on a projector — so there is nothing to protect by
    // keeping it off a phone, and a team at the back of the room should not have to
    // squint at it.
    standings: standings.slice(0, 8),
  };
}

function activityOf(
  team: Team,
  play: TeamQuestion | null,
  phase: Meta['phase'],
): HostTeamRow['activity'] {
  if (play?.verdict?.status === 'graded' || play?.verdict?.status === 'empty') return 'graded';
  if (play !== null && hasSubmission(play)) return 'answered';
  if (team.members.length === 0) return 'waiting';
  return phase === 'play' ? 'reading' : 'waiting';
}

export function buildHostView(
  state: State,
  joinUrl: string,
  graderReady: boolean,
  now: number,
): HostView {
  const question = currentQuestion(state.meta);
  const teams = Object.values(state.teams).sort((a, b) => a.createdAt - b.createdAt);

  const rows: HostTeamRow[] = teams.map((team) => {
    const play = question === null ? null : (team.play[question.id] ?? null);
    return {
      teamId: team.id,
      name: team.name,
      memberCount: team.members.length,
      activity: activityOf(team, play, state.meta.phase),
      pointsThisQuestion: play?.verdict === null || play?.verdict === undefined
        ? null
        : play.verdict.points,
    };
  });

  const plays = question === null ? [] : teams.map((t) => t.play[question.id] ?? null);

  return {
    kind: 'host',
    v: state.meta.v,
    serverTime: now,
    joinUrl,
    room: state.meta.room,
    question: question === null ? null : publicQuestion(state.meta, question),
    reveal: question === null ? null : revealFor(state, question, null),
    teams: rows,
    standings: standingsOf(state),
    answeredCount: plays.filter((p) => p !== null && hasSubmission(p)).length,
    teamCount: rows.length,
    memberCount: memberCount(state.teams),
    pendingGrades: plays.filter((p) => p !== null && hasSubmission(p) && p.verdict === null).length,
    failedGrades: plays.filter((p) => p?.verdict?.status === 'failed').length,
    lastGradeError:
      plays
        .filter((p) => p?.verdict?.status === 'failed')
        .sort((a, b) => (b?.verdict?.gradedAt ?? 0) - (a?.verdict?.gradedAt ?? 0))[0]?.verdict
        ?.reason ?? null,
    graderReady,
  };
}
