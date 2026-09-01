/**
 * Every mutation the game supports, as plain functions over `State`.
 *
 * Nothing here touches HTTP, storage, or the Durable Object, which is what lets the
 * whole API be tested without binding a port or booting workerd. `meeting.ts` is the
 * only file that knows a request is involved.
 */

import { checkName } from '@cpatgt/shared/name';
import { type ErrorCode, fail, isGrid, isJoinCode, isMessage } from '../src/protocol/codes.ts';
import { ROUNDS, type RoundSpec } from '../src/protocol/rounds.ts';
import { bodyCells } from '../src/protocol/grid.ts';
import { isWellFormed } from '../src/protocol/score.ts';
import type { Role } from '../src/protocol/types.ts';
import {
  MAX_DIGITS,
  type Meta,
  type Seat,
  type State,
  type Team,
  appendMessage,
  currentSpec,
  freshMeta,
  messageCount,
  puzzleFor,
  scoreRound,
  teamRound,
} from './state.ts';

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: ErrorCode; message: string };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const no = (error: ErrorCode, message: string): Outcome<never> => ({ ...fail(error, message) });

/** A phone whose seat has been quiet this long is gone, and may be taken over silently. */
const ABANDONED_MS = 90_000;

function token(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSeed(): string {
  return token(16);
}

/**
 * Four digits, never starting with zero.
 *
 * Codes are retired for the whole meeting rather than recycled: a code read off someone
 * else's screen, or a screenshot passed around after a team is removed, must never drop
 * a stranger into a live team.
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
    sender: null,
    receiver: null,
    play: {},
  };
  state.teams[team.id] = team;
  state.meta.codes[code] = team.id;
  state.meta.usedCodes.push(code);
  return ok(team);
}

export type JoinOutcome = { team: Team; role: Role; sessionId: string };

export function join(
  state: State,
  code: string,
  role: Role,
  takeover: boolean,
  now: number,
): Outcome<JoinOutcome> {
  if (!isJoinCode(code)) return no('bad_code', 'A join code is four digits.');
  const teamId = state.meta.codes[code];
  const team = teamId === undefined ? undefined : state.teams[teamId];
  if (team === undefined) return no('bad_code', 'No team with that code.');

  const held = team[role];
  if (held !== null && !takeover && now - held.lastSeenAt < ABANDONED_MS) {
    return no('seat_taken', 'Someone is already in that seat.');
  }
  // Taking a seat invalidates whoever held it — their phone is told, rather than the two
  // of them silently fighting over the same inbox.
  if (held !== null) delete state.meta.sessions[held.sessionId];

  const sessionId = `s_${token(16)}`;
  const seat: Seat = { sessionId, claimedAt: now, lastSeenAt: now };
  team[role] = seat;
  state.meta.sessions[sessionId] = { teamId: team.id, role };
  return ok({ team, role, sessionId });
}

export function resolve(
  state: State,
  sessionId: string | null,
  now: number,
): Outcome<{ team: Team; role: Role }> {
  if (sessionId === null) return no('unknown_session', 'Join a team first.');
  const session = state.meta.sessions[sessionId];
  if (session === undefined) return no('unknown_session', 'That session has expired.');
  const team = state.teams[session.teamId];
  if (team === undefined) return no('unknown_session', 'That team is gone.');

  const seat = team[session.role];
  if (seat !== null && seat.sessionId === sessionId) seat.lastSeenAt = now;
  return ok({ team, role: session.role });
}

export function leave(state: State, sessionId: string): void {
  const session = state.meta.sessions[sessionId];
  if (session === undefined) return;
  const team = state.teams[session.teamId];
  const seat = team?.[session.role];
  if (team !== undefined && seat !== null && seat !== undefined && seat.sessionId === sessionId) {
    team[session.role] = null;
  }
  delete state.meta.sessions[sessionId];
}

function playable(state: State): Outcome<RoundSpec> {
  const spec = currentSpec(state.meta);
  if (spec === null || state.meta.phase !== 'play') {
    return no('round_not_running', 'The round is not running.');
  }
  return ok(spec);
}

export function sendMessage(
  state: State,
  team: Team,
  role: Role,
  body: string,
  clientMsgId: string,
  now: number,
): Outcome<{ seq: number }> {
  const round = playable(state);
  if (!round.ok) return round;
  if (!isMessage(body, MAX_DIGITS)) {
    return no('bad_message', `Messages are 1 to ${MAX_DIGITS} digits.`);
  }
  const play = teamRound(team, round.value, state.meta);

  // A POST that timed out ambiguously and got retried must not be charged twice — the
  // message count is the whole scoreboard.
  const already = play.msgIds[clientMsgId];
  if (already !== undefined) return ok({ seq: already });

  const message = appendMessage(
    state.meta,
    round.value,
    team,
    play,
    role,
    body,
    clientMsgId,
    now,
  );
  return ok({ seq: message.seq });
}

export function paint(
  state: State,
  team: Team,
  role: Role,
  grid: string,
  now: number,
): Outcome<{ rev: number }> {
  if (role !== 'receiver') return no('wrong_role', 'Only the receiver draws.');
  const round = playable(state);
  if (!round.ok) return round;
  const spec = round.value;
  if (!isGrid(grid, spec.size.w * spec.size.h)) return no('bad_grid', 'That is not this grid.');
  if (!isWellFormed(spec.size, grid)) return no('bad_grid', 'That is not a legal snake.');

  // On the round where both players are given the shape, the receiver recolours it and
  // nothing else. Letting them move a cell would turn a colour puzzle back into a shape
  // puzzle, and would let a lost team redraw their way out of it.
  if (spec.shapeGiven) {
    const expected = [...puzzleFor(state.meta, spec).path].sort((a, b) => a - b).join(',');
    if (bodyCells(grid).join(',') !== expected) {
      return no('bad_grid', 'The shape is fixed this round — only the colours change.');
    }
  }

  const play = teamRound(team, spec, state.meta);
  play.grid = grid;
  play.gridRev += 1;
  void now;
  return ok({ rev: play.gridRev });
}

/**
 * Submitting is free and repeatable, and only the last one counts.
 *
 * A single irrevocable submission is the meanest thing this game could do — a typo at
 * 4:58 with no recourse — and there is nothing to protect: the answer is right or it is
 * not, and one bit of "not yet" gives you no gradient to climb. The one guard is that a
 * team must have actually received something first, so nobody can win a round with an
 * empty channel and a lucky guess.
 */
export function submit(
  state: State,
  team: Team,
  role: Role,
  now: number,
): Outcome<{ solved: boolean }> {
  if (role !== 'receiver') return no('wrong_role', 'Only the receiver submits.');
  const round = playable(state);
  if (!round.ok) return round;
  const spec = round.value;
  const play = teamRound(team, spec, state.meta);

  if (!play.messages.some((m) => m.from === 'sender' && m.delivered)) {
    return no('nothing_received', 'Wait for a message first.');
  }

  play.submittedAt = now;
  play.elapsedMs =
    state.meta.roundStartedAt === null ? 0 : Math.min(now - state.meta.roundStartedAt, spec.playMs);
  return ok({ solved: scoreRound(state.meta, spec, play) });
}

/* ------------------------------------------------------------------ host controls */

export type HostAction = 'next' | 'back' | 'pause' | 'nudge';

/**
 * The round walks brief -> play -> reveal, and the host drives it from the keyboard so
 * the room never watches anyone hunt for a cursor.
 */
export function advance(meta: Meta, now: number): void {
  const spec = ROUNDS[meta.roundIndex];

  if (meta.phase === 'lobby' || meta.phase === 'reveal') {
    const next = ROUNDS[meta.roundIndex + 1];
    if (next === undefined) {
      meta.phase = 'done';
      meta.phaseEndsAt = null;
      return;
    }
    meta.roundIndex += 1;
    meta.phase = 'brief';
    meta.roundStartedAt = null;
    meta.phaseEndsAt = now + next.briefMs;
    return;
  }

  if (meta.phase === 'brief' && spec !== undefined) {
    meta.phase = 'play';
    meta.roundStartedAt = now;
    meta.phaseEndsAt = now + spec.playMs;
    return;
  }

  if (meta.phase === 'play') {
    meta.phase = 'reveal';
    meta.phaseEndsAt = null;
  }
}

export function back(meta: Meta, now: number): void {
  if (meta.phase === 'reveal') {
    const spec = ROUNDS[meta.roundIndex];
    meta.phase = 'brief';
    meta.phaseEndsAt = now + (spec?.briefMs ?? 0);
    return;
  }
  if (meta.phase === 'play') {
    const spec = ROUNDS[meta.roundIndex];
    meta.phase = 'brief';
    meta.roundStartedAt = null;
    meta.phaseEndsAt = now + (spec?.briefMs ?? 0);
    return;
  }
  if (meta.phase === 'brief' && meta.roundIndex > 0) {
    meta.roundIndex -= 1;
    meta.phase = 'reveal';
    meta.phaseEndsAt = null;
    return;
  }
  if (meta.phase === 'brief') {
    meta.roundIndex = -1;
    meta.phase = 'lobby';
    meta.phaseEndsAt = null;
  }
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

/** Freeze what every team has when the clock runs out — whatever is on the grid counts. */
export function closeRound(state: State): void {
  const spec = currentSpec(state.meta);
  if (spec === null) return;
  for (const team of Object.values(state.teams)) {
    const play = team.play[spec.id];
    if (play === undefined) continue;
    if (play.submittedAt === null && messageCount(play) > 0) {
      play.elapsedMs = spec.playMs;
      scoreRound(state.meta, spec, play);
    }
  }
}

/** A clean slate in the same room, so the code on the projector does not change. */
export function resetMeeting(state: State, seed: string): void {
  state.meta = freshMeta(state.meta.room, seed);
  for (const id of Object.keys(state.teams)) delete state.teams[id];
}
