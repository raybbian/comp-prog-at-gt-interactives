/**
 * What each session is allowed to know.
 *
 * This is the security-critical file, and the defence is the type system rather than a
 * filter someone has to remember to apply. A receiver with devtools open can read every
 * byte the server sends them, so `ReceiverView` simply has no `target` key to leak, and
 * no view either player can read carries `delivered`. Getting it wrong is a compile
 * error, not something a reviewer has to catch — and `views.test.ts` stringifies the
 * result and asserts the answer is not in there, in case a future field smuggles it out.
 */

import { ROUNDS, type RoundSpec } from '../src/protocol/rounds.ts';
import { differences, rank, tally } from '../src/protocol/score.ts';
import type {
  HostTeamRow,
  HostView,
  PublicMessage,
  PublicRound,
  ReceiverView,
  Reveal,
  Role,
  SeatState,
  SenderView,
  StandingRow,
  TeamPublic,
} from '../src/protocol/types.ts';
import {
  type Message,
  type Meta,
  type State,
  type Team,
  type TeamRound,
  currentSpec,
  inbox,
  messageCount,
  outbox,
  puzzleFor,
  targetFor,
  teamRound,
} from './state.ts';

/** Strips `delivered` and `clientMsgId`. Every message that reaches a phone goes through here. */
function publish(messages: readonly Message[]): PublicMessage[] {
  return messages.map(({ seq, from, body, sentAt }) => ({ seq, from, body, sentAt }));
}

function seat(value: unknown): SeatState {
  return value === null || value === undefined ? 'empty' : 'held';
}

function teamPublic(team: Team): TeamPublic {
  return {
    id: team.id,
    name: team.name,
    code: team.code,
    sender: seat(team.sender),
    receiver: seat(team.receiver),
  };
}

/**
 * Note what is *not* here: the drop rate. Players are told at the briefing that one
 * message in five goes missing; handing the client the exact figure would let someone
 * read it out of a response and work out the schedule.
 */
function publicRound(meta: Meta, spec: RoundSpec, snakeLength: number): PublicRound {
  return {
    id: spec.id,
    index: spec.index,
    total: ROUNDS.length,
    w: spec.size.w,
    h: spec.size.h,
    levels: spec.levels,
    shapeGiven: spec.shapeGiven,
    lossy: spec.dropRate > 0,
    counts: spec.counts,
    phase: meta.phase,
    phaseEndsAt: meta.phaseEndsAt,
    snakeLength,
  };
}

function revealFor(
  state: State,
  spec: RoundSpec,
  round: TeamRound | null,
): Reveal | null {
  if (state.meta.phase !== 'reveal') return null;
  const target = targetFor(state.meta, spec);
  return {
    target,
    differences: round === null ? [] : differences(target, round.grid),
  };
}

export function standingsOf(state: State): StandingRow[] {
  const totals = Object.values(state.teams).map((team) =>
    tally(
      team.id,
      team.name,
      ROUNDS.map((spec) => {
        const round = team.play[spec.id];
        return {
          roundId: spec.id,
          solved: round?.solved ?? false,
          messages: round === undefined ? 0 : messageCount(round),
          elapsedMs: round?.elapsedMs ?? 0,
          counts: spec.counts,
          additiveOnly: spec.additiveOnly,
        };
      }),
    ),
  );
  return rank(totals).map((s, i) => ({
    teamId: s.teamId,
    name: s.name,
    rank: i + 1,
    solved: s.solved,
    messages: s.messages,
    elapsedMs: s.elapsedMs,
  }));
}

type Common = {
  v: number;
  serverTime: number;
  team: TeamPublic;
  round: PublicRound | null;
  shapePath: readonly number[] | null;
  sent: PublicMessage[];
  received: PublicMessage[];
  messagesUsed: number;
  solved: boolean;
  reveal: Reveal | null;
  standing: StandingRow | null;
};

function common(state: State, team: Team, role: Role, now: number): Common {
  const spec = currentSpec(state.meta);
  const round = spec === null ? null : teamRound(team, spec, state.meta);
  const puzzle = spec === null ? null : puzzleFor(state.meta, spec);

  return {
    v: state.meta.v,
    serverTime: now,
    team: teamPublic(team),
    round: spec === null ? null : publicRound(state.meta, spec, puzzle?.path.length ?? 0),
    // On a round where both players are given the shape, the receiver needs the snake
    // itself; the information they are missing is the colours along it.
    shapePath: spec !== null && spec.shapeGiven ? (puzzle?.path ?? []) : null,
    sent: round === null ? [] : publish(outbox(round, role)),
    received: round === null ? [] : publish(inbox(round, role)),
    messagesUsed: round === null ? 0 : messageCount(round),
    solved: round?.solved ?? false,
    reveal: spec === null ? null : revealFor(state, spec, round),
    standing: standingsOf(state).find((s) => s.teamId === team.id) ?? null,
  };
}

export function buildSenderView(state: State, team: Team, now: number): SenderView {
  const spec = currentSpec(state.meta);
  return {
    kind: 'sender',
    ...common(state, team, 'sender', now),
    // The sender is the only person in the room who gets to see the picture.
    // Not during the briefing: protocol time is for agreeing conventions, and a sender
    // staring at the answer for two minutes first is a different game.
    target:
      spec !== null && (state.meta.phase === 'play' || state.meta.phase === 'reveal')
        ? targetFor(state.meta, spec)
        : '',
  };
}

export function buildReceiverView(state: State, team: Team, now: number): ReceiverView {
  const spec = currentSpec(state.meta);
  const round = spec === null ? null : teamRound(team, spec, state.meta);
  return {
    kind: 'receiver',
    ...common(state, team, 'receiver', now),
    grid: round?.grid ?? '',
    gridRev: round?.gridRev ?? 0,
    submittedAt: round?.submittedAt ?? null,
  };
}

function activityOf(team: Team, round: TeamRound | null, now: number): HostTeamRow['activity'] {
  if (round !== null && round.solved) return 'solved';
  if (team.sender === null || team.receiver === null) return 'waiting';
  const last = round?.messages.at(-1);
  if (last !== undefined && now - last.sentAt < 20_000) return 'sending';
  return 'working';
}

export function buildHostView(state: State, joinUrl: string, now: number): HostView {
  const spec = currentSpec(state.meta);
  const teams = Object.values(state.teams).sort((a, b) => a.createdAt - b.createdAt);

  const rows: HostTeamRow[] = teams.map((team) => {
    const round = spec === null ? null : (team.play[spec.id] ?? null);
    return {
      teamId: team.id,
      name: team.name,
      paired: team.sender !== null && team.receiver !== null,
      sender: seat(team.sender),
      receiver: seat(team.receiver),
      activity: activityOf(team, round, now),
      messagesThisRound: round === null ? 0 : messageCount(round),
      solvedThisRound: round?.solved ?? false,
    };
  });

  return {
    kind: 'host',
    v: state.meta.v,
    serverTime: now,
    joinUrl,
    room: state.meta.room,
    round:
      spec === null
        ? null
        : publicRound(state.meta, spec, puzzleFor(state.meta, spec).path.length),
    // The host has the answer up on the projector during the reveal, so this is the one
    // view where the target is meant to be visible.
    reveal: spec === null ? null : revealFor(state, spec, null),
    teams: rows,
    standings: standingsOf(state),
    solvedCount: rows.filter((r) => r.solvedThisRound).length,
    teamCount: rows.length,
    messagesThisRound: rows.reduce((sum, r) => sum + r.messagesThisRound, 0),
  };
}
