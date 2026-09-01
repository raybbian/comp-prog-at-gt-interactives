/**
 * The meeting, as the Durable Object holds it.
 *
 * A Durable Object is single-threaded and globally unique, so this is genuinely one
 * long-running process with everything in memory — no locking, no races between two
 * requests for the same team, and no reconciliation to write. Durable storage sits
 * underneath it so a restart mid-meeting picks up where it left off.
 *
 * These types are server-side and may use optional properties freely. Everything that
 * crosses the wire lives in `src/protocol/types.ts` and obeys the stricter rules there.
 */

import {
  MAX_DIGITS,
  ROUNDS,
  type Puzzle,
  type RoundSpec,
  buildPuzzle,
} from '../src/protocol/rounds.ts';
import type { Phase, Role } from '../src/protocol/types.ts';
import { blank, paint as paintGrid } from '../src/protocol/grid.ts';
import { isDropped } from '../src/protocol/drops.ts';
import { isSolved } from '../src/protocol/score.ts';

export { MAX_DIGITS };

/** A phone that has claimed one half of a team. */
export type Seat = {
  sessionId: string;
  claimedAt: number;
  lastSeenAt: number;
};

export type Message = {
  seq: number;
  /** Ordinal within this direction — what the drop schedule is keyed on. */
  dirSeq: number;
  from: Role;
  body: string;
  sentAt: number;
  /**
   * Server verdict. Never present in anything a sender can read: not knowing is the
   * entire lesson of the lossy round.
   */
  delivered: boolean;
  clientMsgId: string;
};

export type TeamRound = {
  roundId: string;
  messages: Message[];
  /** The receiver's canvas, kept server-side so a locked phone loses nothing. */
  grid: string;
  gridRev: number;
  submittedAt: number | null;
  solved: boolean;
  /** Time from the round starting to the submission that counts. */
  elapsedMs: number;
  /** Idempotency: a retried POST must not be charged twice. */
  msgIds: Record<string, number>;
};

export type Team = {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  sender: Seat | null;
  receiver: Seat | null;
  play: Record<string, TeamRound>;
};

export type Session = { teamId: string; role: Role };

export type Meta = {
  v: number;
  /** The room code this meeting was opened under. Fixed for its lifetime. */
  room: string;
  seed: string;
  phase: Phase;
  /** -1 before the first round starts. */
  roundIndex: number;
  roundStartedAt: number | null;
  phaseEndsAt: number | null;
  /** Set while the host has the clock paused; holds what was left on it. */
  pausedWithMs: number | null;
  codes: Record<string, string>;
  usedCodes: string[];
  sessions: Record<string, Session>;
};

export type State = { meta: Meta; teams: Record<string, Team> };

export function freshMeta(room: string, seed: string): Meta {
  return {
    v: 1,
    room,
    seed,
    phase: 'lobby',
    roundIndex: -1,
    roundStartedAt: null,
    phaseEndsAt: null,
    pausedWithMs: null,
    codes: {},
    usedCodes: [],
    sessions: {},
  };
}

export function currentSpec(meta: Meta): RoundSpec | null {
  return ROUNDS[meta.roundIndex] ?? null;
}

/**
 * On a round where both players are given the shape, the receiver starts with the whole
 * snake already drawn at the lowest level and recolours it.
 *
 * That is not just a convenience. A half-coloured snake would otherwise be a *subset* of
 * the path, and a subset of a path is generally not a path — so every intermediate state
 * would be an illegal drawing that the grid validator had to reject. Starting it filled
 * keeps every state the receiver can reach a legal snake.
 */
export function startingGrid(meta: Meta, spec: RoundSpec): string {
  if (!spec.shapeGiven) return blank(spec.size);
  const { path } = puzzleFor(meta, spec);
  return paintGrid(spec.size, path, new Array<number>(path.length).fill(1));
}

export function teamRound(team: Team, spec: RoundSpec, meta: Meta): TeamRound {
  const existing = team.play[spec.id];
  if (existing !== undefined) return existing;
  const created: TeamRound = {
    roundId: spec.id,
    messages: [],
    grid: startingGrid(meta, spec),
    gridRev: 0,
    submittedAt: null,
    solved: false,
    elapsedMs: 0,
    msgIds: {},
  };
  team.play[spec.id] = created;
  return created;
}

export function inbox(round: TeamRound, role: Role): Message[] {
  // The receiver only ever learns about messages the channel actually delivered; the
  // sender sees their own outbox in full, minus any hint of what happened to it.
  return round.messages.filter((m) => m.from !== role && m.delivered);
}

export function outbox(round: TeamRound, role: Role): Message[] {
  return round.messages.filter((m) => m.from === role);
}

/** Both directions, dropped messages included. Dropping one still costs you it. */
export function messageCount(round: TeamRound): number {
  return round.messages.length;
}

export function appendMessage(
  meta: Meta,
  spec: RoundSpec,
  team: Team,
  round: TeamRound,
  from: Role,
  body: string,
  clientMsgId: string,
  now: number,
): Message {
  const dirSeq = round.messages.filter((m) => m.from === from).length;
  const message: Message = {
    seq: round.messages.length,
    dirSeq,
    from,
    body,
    sentAt: now,
    delivered: !isDropped(`${meta.seed}:${spec.id}`, team.id, from, dirSeq, spec.dropRate),
    clientMsgId,
  };
  round.messages.push(message);
  round.msgIds[clientMsgId] = message.seq;
  return message;
}

/**
 * Generation is deterministic but not free — the sixteen-by-sixteen round backtracks for
 * a few milliseconds — and every poll from every phone would otherwise pay for it. One
 * meeting only ever has six puzzles in it, so memoise them for the life of the object.
 */
const puzzles = new Map<string, Puzzle>();

export function puzzleFor(meta: Meta, spec: RoundSpec): Puzzle {
  const key = `${meta.seed}:${spec.id}`;
  const hit = puzzles.get(key);
  if (hit !== undefined) return hit;
  const built = buildPuzzle(spec, meta.seed);
  puzzles.set(key, built);
  return built;
}

export function targetFor(meta: Meta, spec: RoundSpec): string {
  return puzzleFor(meta, spec).grid;
}

export function scoreRound(meta: Meta, spec: RoundSpec, round: TeamRound): boolean {
  round.solved = isSolved(targetFor(meta, spec), round.grid);
  return round.solved;
}

/** How long a team has been on this round, clamped so a late joiner is not unbounded. */
export function elapsedFor(meta: Meta, spec: RoundSpec, now: number): number {
  if (meta.roundStartedAt === null) return 0;
  return Math.min(now - meta.roundStartedAt, spec.playMs);
}

export function pairedCount(teams: Record<string, Team>): number {
  return Object.values(teams).filter((t) => t.sender !== null && t.receiver !== null).length;
}
