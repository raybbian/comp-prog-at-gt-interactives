/**
 * The meeting, as the Durable Object holds it.
 *
 * A Durable Object is single-threaded and globally unique, so this is genuinely one
 * long-running process with everything in memory — no locking, no races between two
 * phones on the same team, and no reconciliation to write. Durable storage sits
 * underneath it so a restart mid-meeting picks up where it left off. Grading depends on
 * that more than anything else here does: a verdict that came back from the model is a
 * thing we paid for, and it must not be lost because the object was evicted.
 *
 * These types are server-side and may use optional properties freely. Everything that
 * crosses the wire lives in `src/protocol/types.ts` and obeys the stricter rules there.
 */

import { QUESTIONS, type QuestionSpec } from '../src/protocol/questions.ts';
import type { Phase } from '../src/protocol/types.ts';
import { verdictPoints } from '../src/protocol/score.ts';

/** A phone that has joined a team. No roles: everyone round the snippet is equal. */
export type Member = {
  sessionId: string;
  /** `1`, `2`, … within the team. Shown as "phone 2" so nobody types a name twice. */
  seat: string;
  joinedAt: number;
  lastSeenAt: number;
};

/** What came back from the grader, plus what it cost us to find out. */
export type StoredVerdict = {
  status: 'graded' | 'empty' | 'failed';
  complexityCorrect: boolean;
  bugIds: string[];
  note: string;
  points: number;
  gradedAt: number;
  model: string;
  /** Why it failed, for the host's board. Never shown to a team. */
  reason: string;
};

export type TeamQuestion = {
  questionId: string;
  complexity: string;
  findings: string;
  submittedAt: number | null;
  /** The seat that sent the submission that counts. */
  submittedBy: string | null;
  /** Time from the question opening to that submission. */
  elapsedMs: number;
  verdict: StoredVerdict | null;
  /** Grading attempts spent. Capped, so a broken key cannot bill us in a loop. */
  attempts: number;
};

export type Team = {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  members: Member[];
  play: Record<string, TeamQuestion>;
};

export type Session = { teamId: string; seat: string };

export type Meta = {
  v: number;
  /** The six digits on the projector. This object is named after them. */
  room: string;
  phase: Phase;
  /** -1 before the first question opens. */
  questionIndex: number;
  questionStartedAt: number | null;
  phaseEndsAt: number | null;
  /** Set while the host has the clock paused; holds what was left on it. */
  pausedWithMs: number | null;
  codes: Record<string, string>;
  usedCodes: string[];
  sessions: Record<string, Session>;
};

export type State = { meta: Meta; teams: Record<string, Team> };

/** A team of more than this is a lecture, not a team, and it starves the small ones. */
export const MAX_MEMBERS = 8;

export function freshMeta(room: string): Meta {
  return {
    v: 1,
    room,
    phase: 'lobby',
    questionIndex: -1,
    questionStartedAt: null,
    phaseEndsAt: null,
    pausedWithMs: null,
    codes: {},
    usedCodes: [],
    sessions: {},
  };
}

export function currentQuestion(meta: Meta): QuestionSpec | null {
  return QUESTIONS[meta.questionIndex] ?? null;
}

export function teamQuestion(team: Team, question: QuestionSpec): TeamQuestion {
  const existing = team.play[question.id];
  if (existing !== undefined) return existing;
  const created: TeamQuestion = {
    questionId: question.id,
    complexity: '',
    findings: '',
    submittedAt: null,
    submittedBy: null,
    elapsedMs: 0,
    verdict: null,
    attempts: 0,
  };
  team.play[question.id] = created;
  return created;
}

export function hasSubmission(play: TeamQuestion): boolean {
  return play.submittedAt !== null && (play.complexity.trim() + play.findings.trim()).length > 0;
}

/**
 * The verdict for a team that never submitted.
 *
 * Written without calling the model, which is the point: an empty box is not a judgement
 * call, and a room where half the teams skip a hard question should not cost half a
 * question's worth of requests to find that out.
 */
export function emptyVerdict(now: number): StoredVerdict {
  return {
    status: 'empty',
    complexityCorrect: false,
    bugIds: [],
    note: 'Nothing was submitted for this one.',
    points: 0,
    gradedAt: now,
    model: '',
    reason: '',
  };
}

export function gradedVerdict(
  complexityCorrect: boolean,
  bugIds: readonly string[],
  note: string,
  model: string,
  now: number,
): StoredVerdict {
  return {
    status: 'graded',
    complexityCorrect,
    bugIds: [...bugIds],
    note,
    // The one place points are computed, from tested code the model never touches.
    points: verdictPoints(complexityCorrect, bugIds.length),
    gradedAt: now,
    model,
    reason: '',
  };
}

export function failedVerdict(reason: string, now: number): StoredVerdict {
  return {
    status: 'failed',
    complexityCorrect: false,
    bugIds: [],
    note: 'This one could not be graded. A volunteer can retry it.',
    points: 0,
    gradedAt: now,
    model: '',
    reason,
  };
}

export function memberCount(teams: Record<string, Team>): number {
  return Object.values(teams).reduce((sum, team) => sum + team.members.length, 0);
}
