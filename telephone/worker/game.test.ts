import { describe, expect, it } from 'vitest';
import { ROUNDS } from '../src/protocol/rounds.ts';
import {
  advance,
  closeRound,
  createTeam,
  join,
  leave,
  paint,
  resetMeeting,
  resolve,
  sendMessage,
  submit,
} from './actions.ts';
import { type State, freshMeta, targetFor, teamRound } from './state.ts';
import { buildHostView, buildReceiverView, buildSenderView } from './views.ts';

const NOW = 1_800_000_000_000;

function meeting(seed = 'test-seed'): State {
  return { meta: freshMeta('482913', seed), teams: {} };
}

/** Create a team and sit a phone in each seat. */
function seated(state: State, name = 'TEAM') {
  const made = createTeam(state, name);
  if (!made.ok) throw new Error('could not create team');
  const team = made.value;
  const sender = join(state, team.code, 'sender', false, NOW);
  const receiver = join(state, team.code, 'receiver', false, NOW);
  if (!sender.ok || !receiver.ok) throw new Error('could not seat both phones');
  return { team, senderSession: sender.value.sessionId, receiverSession: receiver.value.sessionId };
}

/** Walk the meeting to the playing phase of round `index`. */
function playRound(state: State, index: number): void {
  while (state.meta.roundIndex < index || state.meta.phase !== 'play') {
    advance(state.meta, NOW);
    if (state.meta.phase === 'done') throw new Error('ran out of rounds');
  }
}

describe('what a receiver is allowed to know', () => {
  /**
   * The single most important test in the project. A receiver can read every byte the
   * server sends them, so if the answer is anywhere in their view the game is over —
   * and nobody would find out until a student mentioned it afterwards.
   */
  it('never sends the answer to the receiver while the round is live', () => {
    for (const spec of ROUNDS) {
      const state = meeting();
      const { team } = seated(state);
      playRound(state, spec.index);

      const target = targetFor(state.meta, spec);
      const view = buildReceiverView(state, team, NOW);
      expect(JSON.stringify(view), spec.id).not.toContain(target);
      expect(view).not.toHaveProperty('target');
    }
  });

  it('does not leak the answer during the briefing either', () => {
    const state = meeting();
    const { team } = seated(state);
    advance(state.meta, NOW); // -> brief on round 0
    expect(state.meta.phase).toBe('brief');

    const spec = ROUNDS[0];
    if (spec === undefined) throw new Error('missing round');
    const target = targetFor(state.meta, spec);
    expect(JSON.stringify(buildReceiverView(state, team, NOW))).not.toContain(target);
    // The sender does not get a two-minute head start staring at the picture, either.
    expect(buildSenderView(state, team, NOW).target).toBe('');
  });

  it('shows the receiver the answer once the round is revealed', () => {
    const state = meeting();
    const { team } = seated(state);
    playRound(state, 0);
    const spec = ROUNDS[0];
    if (spec === undefined) throw new Error('missing round');
    advance(state.meta, NOW); // -> reveal

    const view = buildReceiverView(state, team, NOW);
    expect(view.reveal?.target).toBe(targetFor(state.meta, spec));
  });

  it('hands the shape over on the round that gives it to both players', () => {
    const shapeGiven = ROUNDS.find((r) => r.shapeGiven);
    if (shapeGiven === undefined) throw new Error('no shape-given round');
    const state = meeting();
    const { team } = seated(state);
    playRound(state, shapeGiven.index);

    const view = buildReceiverView(state, team, NOW);
    expect(view.shapePath).not.toBeNull();
    expect(view.shapePath).toHaveLength(shapeGiven.shape.kind === 'induced' ? shapeGiven.shape.length : 0);
    // The shape, but not the colours: the levels are the whole point of that round.
    expect(JSON.stringify(view)).not.toContain(targetFor(state.meta, shapeGiven));
  });
});

describe('what a sender is allowed to know', () => {
  /**
   * No delivery receipts. On the lossy round the sender genuinely cannot tell a message
   * that arrived from one that did not, and that ambiguity is the thing being taught.
   */
  it('never tells either phone whether a message landed', () => {
    const lossy = ROUNDS.find((r) => r.dropRate > 0);
    if (lossy === undefined) throw new Error('no lossy round');
    const state = meeting();
    const { team } = seated(state);
    playRound(state, lossy.index);

    for (let i = 0; i < 20; i += 1) {
      sendMessage(state, team, 'sender', '1234', `m${i}`, NOW + i);
    }
    const round = teamRound(team, lossy, state.meta);
    expect(round.messages.some((m) => !m.delivered)).toBe(true);

    for (const view of [buildSenderView(state, team, NOW), buildReceiverView(state, team, NOW)]) {
      expect(JSON.stringify(view)).not.toContain('delivered');
      expect(JSON.stringify(view)).not.toContain('clientMsgId');
    }
  });

  it('gives the receiver only the messages that actually arrived', () => {
    const lossy = ROUNDS.find((r) => r.dropRate > 0);
    if (lossy === undefined) throw new Error('no lossy round');
    const state = meeting();
    const { team } = seated(state);
    playRound(state, lossy.index);
    for (let i = 0; i < 10; i += 1) sendMessage(state, team, 'sender', '55', `m${i}`, NOW + i);

    const sent = buildSenderView(state, team, NOW).sent.length;
    const arrived = buildReceiverView(state, team, NOW).received.length;
    expect(sent).toBe(10);
    expect(arrived).toBeLessThan(sent);
    // Dropped or not, it still cost them the message.
    expect(buildSenderView(state, team, NOW).messagesUsed).toBe(10);
  });
});

describe('playing a round', () => {
  it('solves when the receiver draws the picture, and not before', () => {
    const state = meeting();
    const { team } = seated(state);
    playRound(state, 1);
    const spec = ROUNDS[1];
    if (spec === undefined) throw new Error('missing round');

    // A submission with nothing received is refused, so no team can win on a guess.
    expect(submit(state, team, 'receiver', NOW).ok).toBe(false);

    sendMessage(state, team, 'sender', '4711', 'a', NOW);
    const wrong = submit(state, team, 'receiver', NOW + 1);
    expect(wrong.ok && wrong.value.solved).toBe(false);

    const painted = paint(state, team, 'receiver', targetFor(state.meta, spec), NOW + 2);
    expect(painted.ok).toBe(true);
    const right = submit(state, team, 'receiver', NOW + 3);
    expect(right.ok && right.value.solved).toBe(true);
  });

  it('refuses a drawing that is not a legal snake', () => {
    const state = meeting();
    const { team } = seated(state);
    playRound(state, 1);
    const spec = ROUNDS[1];
    if (spec === undefined) throw new Error('missing round');
    const solid = '1'.repeat(spec.size.w * spec.size.h);
    const rejected = paint(state, team, 'receiver', solid, NOW);
    expect(rejected.ok).toBe(false);
  });

  it('charges a retried send once', () => {
    const state = meeting();
    const { team } = seated(state);
    playRound(state, 1);

    const first = sendMessage(state, team, 'sender', '999', 'same-id', NOW);
    const retry = sendMessage(state, team, 'sender', '999', 'same-id', NOW + 500);
    expect(first.ok && retry.ok && first.value.seq === retry.value.seq).toBe(true);
    expect(buildSenderView(state, team, NOW).messagesUsed).toBe(1);
  });

  it('counts the reply channel against the same total', () => {
    const state = meeting();
    const { team } = seated(state);
    playRound(state, 1);
    sendMessage(state, team, 'sender', '1', 'a', NOW);
    sendMessage(state, team, 'receiver', '2', 'b', NOW + 1);
    expect(buildSenderView(state, team, NOW).messagesUsed).toBe(2);
  });

  it('refuses messages when the clock is not running', () => {
    const state = meeting();
    const { team } = seated(state);
    advance(state.meta, NOW); // brief, not play
    expect(sendMessage(state, team, 'sender', '1', 'a', NOW).ok).toBe(false);
  });

  it('keeps whatever is on the grid when the clock runs out', () => {
    const state = meeting();
    const { team } = seated(state);
    playRound(state, 1);
    const spec = ROUNDS[1];
    if (spec === undefined) throw new Error('missing round');

    sendMessage(state, team, 'sender', '1', 'a', NOW);
    paint(state, team, 'receiver', targetFor(state.meta, spec), NOW + 1);
    // No submit — the round simply ends.
    closeRound(state);
    expect(teamRound(team, spec, state.meta).solved).toBe(true);
  });
});

describe('seats', () => {
  it('refuses a seat someone is already sitting in', () => {
    const state = meeting();
    const { team } = seated(state);
    const second = join(state, team.code, 'sender', false, NOW + 1000);
    expect(second.ok).toBe(false);
  });

  it('lets a phone take over a seat, and revokes the old one', () => {
    const state = meeting();
    const { team, senderSession } = seated(state);
    const taken = join(state, team.code, 'sender', true, NOW + 1000);
    expect(taken.ok).toBe(true);
    expect(resolve(state, senderSession, NOW + 1000).ok).toBe(false);
  });

  it('lets a phone back in without asking once the old one has gone quiet', () => {
    const state = meeting();
    const { team } = seated(state);
    // Ninety seconds of silence means that phone is in someone's pocket.
    const later = NOW + 120_000;
    expect(join(state, team.code, 'sender', false, later).ok).toBe(true);
  });

  it('gives every team its own code and never reuses one', () => {
    const state = meeting();
    const codes = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const made = createTeam(state, `TEAM ${i}`);
      if (!made.ok) throw new Error('could not create team');
      expect(codes.has(made.value.code)).toBe(false);
      codes.add(made.value.code);
      expect(made.value.code).toMatch(/^[1-9][0-9]{3}$/);
    }
  });

  it('uniquifies a duplicate name rather than turning the team away', () => {
    const state = meeting();
    const first = createTeam(state, 'SEGFAULT');
    const second = createTeam(state, 'SEGFAULT');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.name).not.toBe(first.value.name);
  });

  it('frees the seat when a player leaves, and leaves the team standing', () => {
    const state = meeting();
    const { team, senderSession } = seated(state);

    leave(state, senderSession);

    expect(team.sender).toBeNull();
    expect(team.receiver).not.toBeNull();
    expect(resolve(state, senderSession, NOW).ok).toBe(false);
    // Free rather than contested, so the pair can swap round without a takeover.
    expect(join(state, team.code, 'sender', false, NOW).ok).toBe(true);
  });
});

describe('the best in the room', () => {
  const revealOf = (state: State, team: Parameters<typeof buildReceiverView>[1]) => {
    advance(state.meta, NOW); // -> reveal
    return buildReceiverView(state, team, NOW).reveal;
  };

  it('is the fewest messages anyone solved it in', () => {
    const state = meeting();
    const tight = seated(state, 'TIGHT');
    const loose = seated(state, 'LOOSE');
    playRound(state, 1);
    const spec = ROUNDS[1];
    if (spec === undefined) throw new Error('missing round');
    const target = targetFor(state.meta, spec);

    sendMessage(state, tight.team, 'sender', '11', 'a', NOW);
    paint(state, tight.team, 'receiver', target, NOW);
    submit(state, tight.team, 'receiver', NOW);

    for (let i = 0; i < 9; i += 1) {
      sendMessage(state, loose.team, 'sender', '22', `b${i}`, NOW + i);
    }
    paint(state, loose.team, 'receiver', target, NOW);
    submit(state, loose.team, 'receiver', NOW);

    expect(revealOf(state, loose.team)?.best).toBe(1);
  });

  /**
   * Every team loses a different set of messages on the lossy round, so the counts are not
   * the same measurement. A winner there would be an artefact of who got unlucky.
   */
  it('is not published on the round whose messages do not compare', () => {
    const lossy = ROUNDS.find((r) => r.additiveOnly);
    if (lossy === undefined) throw new Error('no additive-only round');
    const state = meeting();
    const { team } = seated(state);
    playRound(state, lossy.index);

    for (let i = 0; i < 6; i += 1) sendMessage(state, team, 'sender', '7', `m${i}`, NOW + i);
    paint(state, team, 'receiver', targetFor(state.meta, lossy), NOW);
    submit(state, team, 'receiver', NOW);

    const reveal = revealOf(state, team);
    expect(reveal).not.toBeNull();
    expect(reveal?.best).toBeNull();
  });
});

describe('the host board', () => {
  it('ranks on rounds solved, then messages', () => {
    const state = meeting();
    const tight = seated(state, 'TIGHT');
    const loose = seated(state, 'LOOSE');
    playRound(state, 1);
    const spec = ROUNDS[1];
    if (spec === undefined) throw new Error('missing round');
    const target = targetFor(state.meta, spec);

    sendMessage(state, tight.team, 'sender', '11', 'a', NOW);
    paint(state, tight.team, 'receiver', target, NOW);
    submit(state, tight.team, 'receiver', NOW);

    for (let i = 0; i < 9; i += 1) {
      sendMessage(state, loose.team, 'sender', '22', `b${i}`, NOW + i);
    }
    paint(state, loose.team, 'receiver', target, NOW);
    submit(state, loose.team, 'receiver', NOW);

    const board = buildHostView(state, 'https://example.test', NOW).standings;
    expect(board[0]?.name).toBe('TIGHT');
    expect(board[1]?.name).toBe('LOOSE');
  });

  it('flags a team that is still missing a partner', () => {
    const state = meeting();
    const made = createTeam(state, 'ALONE');
    if (!made.ok) throw new Error('could not create team');
    join(state, made.value.code, 'sender', false, NOW);

    const row = buildHostView(state, 'https://example.test', NOW).teams[0];
    expect(row?.paired).toBe(false);
    expect(row?.activity).toBe('waiting');
    expect(row?.receiver).toBe('empty');
  });

  it('never puts a join code on the board, paired or not', () => {
    const state = meeting();
    const made = createTeam(state, 'ALONE');
    if (!made.ok) throw new Error('could not create team');

    const alone = buildHostView(state, 'https://example.test', NOW).teams[0];
    expect(alone).not.toHaveProperty('code');

    join(state, made.value.code, 'sender', false, NOW);
    join(state, made.value.code, 'receiver', false, NOW);
    const paired = buildHostView(state, 'https://example.test', NOW).teams[0];
    expect(paired).not.toHaveProperty('code');
  });

  it('keeps the room code across a reset, so the projector does not change', () => {
    const state = meeting();
    seated(state, 'GONE');
    resetMeeting(state, 'another-seed');

    expect(state.meta.room).toBe('482913');
    expect(buildHostView(state, 'https://example.test', NOW).room).toBe('482913');
    expect(Object.keys(state.teams)).toHaveLength(0);
  });

  it('leaves the warm-up round out of the standings', () => {
    const state = meeting();
    const { team } = seated(state);
    playRound(state, 0);
    const spec = ROUNDS[0];
    if (spec === undefined) throw new Error('missing round');
    sendMessage(state, team, 'sender', '1', 'a', NOW);
    paint(state, team, 'receiver', targetFor(state.meta, spec), NOW);
    submit(state, team, 'receiver', NOW);

    const board = buildHostView(state, 'https://example.test', NOW).standings;
    expect(board[0]?.solved).toBe(0);
    expect(board[0]?.messages).toBe(0);
  });
});
