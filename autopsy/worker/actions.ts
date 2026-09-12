/**
 * Every mutation the game supports, as plain functions over `State`.
 *
 * Nothing here touches HTTP, storage, or the Durable Object, which is what lets the whole
 * API be tested without binding a port or booting workerd. `meeting.ts` is the only file
 * that knows a request is involved, and `grader.ts` the only one that knows a model is.
 */

import { checkName } from '@cpatgt/shared/name';
import {
  type ErrorCode,
  fail,
  isAnswer,
  isJoinCode,
  MAX_COMPLEXITY_CHARS,
  MAX_FINDINGS_CHARS,
  normalizeAnswer,
} from '../src/protocol/codes.ts';
import { QUESTIONS, type QuestionSpec } from '../src/protocol/questions.ts';
import {
  MAX_MEMBERS,
  type Meta,
  type State,
  type Team,
  type TeamQuestion,
  currentQuestion,
  emptyVerdict,
  freshMeta,
  hasSubmission,
  teamQuestion,
} from './state.ts';

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: ErrorCode; message: string };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const no = (error: ErrorCode, message: string): Outcome<never> => ({ ...fail(error, message) });

/** A phone quiet this long has left, and its seat may be reused by a new joiner. */
const ABANDONED_MS = 120_000;

function token(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Four digits, never starting with zero.
 *
 * Codes are retired for the whole meeting rather than recycled: a code read off someone
 * else's screen, or a screenshot passed around after a team is removed, must never drop a
 * stranger into a live team.
 */
function mintCode(meta: Meta): string | null {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    if (/^(\d)\1{3}$/.test(code)) continue;
    if (meta.codes[code] !== undefined) continue;
    if (meta.usedCodes.includes(code)) continue;
    return code;
  }
  return null;
}

/**
 * Names are uniquified, never rejected. Turning away a duplicate during a twenty-team
 * join stampede costs a volunteer half a minute every time it happens.
 */
function uniqueName(state: State, wanted: string): string {
  const taken = new Set(Object.values(state.teams).map((t) => t.name));
  if (!taken.has(wanted)) return wanted;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${wanted.slice(0, 9)} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${wanted.slice(0, 8)} ${token(2)}`;
}

export function createTeam(state: State, rawName: string): Outcome<Team> {
  const checked = checkName(rawName);
  if (!checked.ok) {
    return no('name_required', checked.reason === 'empty' ? 'Pick a team name.' : 'Pick another name.');
  }
  const code = mintCode(state.meta);
  if (code === null) return no('server_full', 'No join codes left.');

  const team: Team = {
    id: `t_${token(6)}`,
    name: uniqueName(state, checked.name),
    code,
    createdAt: Date.now(),
    members: [],
    play: {},
  };
  state.teams[team.id] = team;
  state.meta.codes[code] = team.id;
  state.meta.usedCodes.push(code);
  return ok(team);
}

export type JoinOutcome = { team: Team; seat: string; sessionId: string };

/**
 * Joining a team, which unlike Telephone has no seats to fight over.
 *
 * Everyone who types the code gets in and everyone can submit. The coordination problem
 * that would normally need solving here — who holds the pen — is solved by the four of
 * them standing in the same place, which is a better mechanism than anything the server
 * could impose and is why the game asks them to sit together in the first place.
 */
export function join(state: State, code: string, now: number): Outcome<JoinOutcome> {
  if (!isJoinCode(code)) return no('bad_code', 'A join code is four digits.');
  const teamId = state.meta.codes[code];
  const team = teamId === undefined ? undefined : state.teams[teamId];
  if (team === undefined) return no('bad_code', 'No team with that code.');

  // Reclaim a phone that has been gone for two minutes before refusing a real one.
  const live = team.members.filter((m) => now - m.lastSeenAt < ABANDONED_MS);
  if (live.length >= MAX_MEMBERS) {
    return no('team_full', `A team holds ${MAX_MEMBERS} phones. Start another one.`);
  }
  for (const gone of team.members.filter((m) => !live.includes(m))) {
    delete state.meta.sessions[gone.sessionId];
  }
  team.members = live;

  // Seats are numbered by the lowest free number rather than by count, so a team whose
  // second phone died and rejoined does not end up with two phones both called 3.
  const used = new Set(team.members.map((m) => m.seat));
  let seat = 1;
  while (used.has(String(seat))) seat += 1;

  const sessionId = `s_${token(16)}`;
  team.members.push({ sessionId, seat: String(seat), joinedAt: now, lastSeenAt: now });
  state.meta.sessions[sessionId] = { teamId: team.id, seat: String(seat) };
  return ok({ team, seat: String(seat), sessionId });
}

export function resolve(
  state: State,
  sessionId: string | null,
  now: number,
): Outcome<{ team: Team; seat: string }> {
  if (sessionId === null) return no('unknown_session', 'Join a team first.');
  const session = state.meta.sessions[sessionId];
  if (session === undefined) return no('unknown_session', 'That session has expired.');
  const team = state.teams[session.teamId];
  if (team === undefined) return no('unknown_session', 'That team is gone.');

  const member = team.members.find((m) => m.sessionId === sessionId);
  if (member !== undefined) member.lastSeenAt = now;
  return ok({ team, seat: session.seat });
}

export function leave(state: State, sessionId: string): void {
  const session = state.meta.sessions[sessionId];
  if (session === undefined) return;
  const team = state.teams[session.teamId];
  if (team !== undefined) {
    team.members = team.members.filter((m) => m.sessionId !== sessionId);
  }
  delete state.meta.sessions[sessionId];
}

function open(state: State): Outcome<QuestionSpec> {
  const question = currentQuestion(state.meta);
  if (question === null || state.meta.phase !== 'play') {
    return no('question_not_open', 'That question is closed.');
  }
  return ok(question);
}

/**
 * Submitting, which is free, repeatable, and shared by the whole team.
 *
 * Only the last submission counts, and there is nothing to protect by making it
 * otherwise: **grading happens once, after the question closes.** That single decision is
 * what makes free resubmission safe — a team gets no feedback to iterate against, so
 * there is no gradient to climb and no way to probe the grader by submitting twenty
 * variations and watching the number move. It also means a question costs one request per
 * team no matter how many times they change their minds, which is the difference between
 * a bill in dollars and a bill worth thinking about.
 */
export function submit(
  state: State,
  team: Team,
  seat: string,
  rawComplexity: string,
  rawFindings: string,
  now: number,
): Outcome<{ play: TeamQuestion }> {
  const question = open(state);
  if (!question.ok) return question;

  const complexity = normalizeAnswer(rawComplexity, MAX_COMPLEXITY_CHARS);
  const findings = normalizeAnswer(rawFindings, MAX_FINDINGS_CHARS);
  if (!isAnswer(complexity, findings)) return no('bad_answer', 'Write something first.');

  const play = teamQuestion(team, question.value);
  play.complexity = complexity;
  play.findings = findings;
  play.submittedAt = now;
  play.submittedBy = seat;
  play.elapsedMs =
    state.meta.questionStartedAt === null
      ? 0
      : Math.min(now - state.meta.questionStartedAt, question.value.playMs);
  // A resubmission after a failed grade deserves a fresh look.
  if (play.verdict?.status !== 'graded') {
    play.verdict = null;
    play.attempts = 0;
  }
  return ok({ play });
}

/* ------------------------------------------------------------------ host controls */

export type HostAction = 'next' | 'back' | 'pause' | 'nudge' | 'regrade';

/**
 * The question walks play -> grading -> reveal, and the host drives it from the keyboard
 * so the room never watches anyone hunt for a cursor.
 *
 * There is deliberately no briefing phase in between. A snippet is its own briefing — the
 * moment it is on the projector the reading has started — and a phase whose content is
 * "the next one is about a graph" would only tell teams what to look for.
 */
export function advance(meta: Meta, now: number): void {
  if (meta.phase === 'lobby' || meta.phase === 'reveal') {
    const next = QUESTIONS[meta.questionIndex + 1];
    if (next === undefined) {
      meta.phase = 'done';
      meta.phaseEndsAt = null;
      return;
    }
    meta.questionIndex += 1;
    meta.phase = 'play';
    meta.questionStartedAt = now;
    meta.phaseEndsAt = now + next.playMs;
    meta.pausedWithMs = null;
    return;
  }

  if (meta.phase === 'play') {
    meta.phase = 'grading';
    // A cap, not a duration: grading is done when the verdicts are in, and this is only
    // the point at which the room stops waiting for a model that is not coming back.
    meta.phaseEndsAt = now + GRADING_CAP_MS;
    meta.pausedWithMs = null;
    return;
  }

  if (meta.phase === 'grading') {
    meta.phase = 'reveal';
    meta.phaseEndsAt = null;
  }
}

/** Long enough for twenty verdicts, short enough that a room does not notice waiting. */
export const GRADING_CAP_MS = 90_000;

/** What reopening a closed question puts back on the clock. Enough to finish a sentence. */
export const REOPEN_MS = 60_000;

/**
 * The back key, and the one thing it is not allowed to do.
 *
 * From `grading` it reopens the question, which is the whole point of having the key: a
 * host who advanced while three teams were still typing can undo it. It comes back with a
 * minute on the clock rather than the full time, because that is what the situation
 * actually is, and verdicts already paid for are left alone.
 *
 * From `reveal` it goes to the *previous* question and never back into this one. The key
 * is on the projector by then and no amount of state machine takes it out of the room
 * again; a reopened question after a reveal would be a question every team scores full
 * marks on. That asymmetry is the reason `revealFor` withholds the answer during
 * `grading` — it is what keeps the reopenable phase the safe one.
 */
export function back(meta: Meta, now: number): void {
  if (meta.phase === 'grading') {
    meta.phase = 'play';
    meta.phaseEndsAt = now + REOPEN_MS;
    meta.questionStartedAt = meta.questionStartedAt ?? now;
    return;
  }

  if (meta.phase === 'done') {
    meta.phase = 'reveal';
    meta.phaseEndsAt = null;
    return;
  }

  // `play` and `reveal` both step to the question before this one, at its reveal.
  if (meta.questionIndex > 0) {
    meta.questionIndex -= 1;
    meta.phase = 'reveal';
    meta.questionStartedAt = null;
    meta.phaseEndsAt = null;
    return;
  }
  meta.questionIndex = -1;
  meta.phase = 'lobby';
  meta.questionStartedAt = null;
  meta.phaseEndsAt = null;
}

export function togglePause(meta: Meta, now: number): void {
  if (meta.pausedWithMs !== null) {
    meta.phaseEndsAt = now + meta.pausedWithMs;
    meta.pausedWithMs = null;
    return;
  }
  if (meta.phaseEndsAt === null) return;
  meta.pausedWithMs = Math.max(0, meta.phaseEndsAt - now);
  meta.phaseEndsAt = null;
}

export function nudge(meta: Meta, ms: number): void {
  if (meta.pausedWithMs !== null) {
    meta.pausedWithMs = Math.max(0, meta.pausedWithMs + ms);
    return;
  }
  if (meta.phaseEndsAt === null) return;
  meta.phaseEndsAt += ms;
}

/**
 * Freeze what every team has when the clock runs out, and settle the ones that need no
 * model: an empty box is worth nothing and costs nothing to establish.
 */
export function closeQuestion(state: State, now: number): void {
  const question = currentQuestion(state.meta);
  if (question === null) return;
  for (const team of Object.values(state.teams)) {
    const play = teamQuestion(team, question);
    if (play.verdict !== null) continue;
    if (!hasSubmission(play)) play.verdict = emptyVerdict(now);
  }
}

/** Clears failed verdicts so the grading pass will try them again. */
export function regrade(state: State): number {
  const question = currentQuestion(state.meta);
  if (question === null) return 0;
  let cleared = 0;
  for (const team of Object.values(state.teams)) {
    const play = team.play[question.id];
    if (play === undefined) continue;
    if (play.verdict?.status === 'failed') {
      play.verdict = null;
      play.attempts = 0;
      cleared += 1;
    }
  }
  return cleared;
}

/** Everything goes but the room code: the board on the wall must not change under a room. */
export function resetMeeting(state: State): void {
  state.meta = freshMeta(state.meta.room);
  for (const id of Object.keys(state.teams)) delete state.teams[id];
}
