import { describe, expect, it } from 'vitest';
import { MAX_FINDINGS_CHARS } from '../src/protocol/codes.ts';
import { QUESTIONS } from '../src/protocol/questions.ts';
import { verdictPoints } from '../src/protocol/score.ts';
import { answerFor } from './answers.ts';
import {
  advance,
  back,
  closeQuestion,
  createTeam,
  join,
  leave,
  nudge,
  regrade,
  resetMeeting,
  resolve,
  submit,
  togglePause,
} from './actions.ts';
import {
  MAX_MEMBERS,
  type State,
  emptyVerdict,
  failedVerdict,
  freshMeta,
  gradedVerdict,
  teamQuestion,
} from './state.ts';
import { buildHostView, buildPlayerView, standingsOf } from './views.ts';

const NOW = 1_800_000_000_000;
const ROOM = '482913';

function meeting(): State {
  return { meta: freshMeta(ROOM), teams: {} };
}

/** Create a team and sit one phone on it. */
function seated(state: State, name = 'TEAM') {
  const made = createTeam(state, name);
  if (!made.ok) throw new Error('could not create team');
  const joined = join(state, made.value.code, NOW);
  if (!joined.ok) throw new Error('could not join');
  return { team: made.value, seat: joined.value.seat, sessionId: joined.value.sessionId };
}

/** Walk the meeting to the playing phase of question `index`. */
function playQuestion(state: State, index: number): void {
  while (state.meta.questionIndex < index || state.meta.phase !== 'play') {
    advance(state.meta, NOW);
    if (state.meta.phase === 'done') throw new Error('ran out of questions');
  }
}

describe('what a team is allowed to know', () => {
  /**
   * The single most important test in the project. A team can read every byte the server
   * sends them, so if the answer key is anywhere in their view the game is over — and nobody
   * would find out until a student mentioned it afterwards.
   */
  it('never sends the answer key to a team while the question is open', () => {
    for (const question of QUESTIONS) {
      const key = answerFor(question.id);
      if (key === null) throw new Error(`no key for ${question.id}`);
      const state = meeting();
      const { team, seat } = seated(state);
      playQuestion(state, question.index);

      const payload = JSON.stringify(buildPlayerView(state, team, seat, NOW));
      expect(payload, `${question.id} complexity`).not.toContain(key.complexity);
      for (const bug of key.bugs) {
        expect(payload, bug.id).not.toContain(bug.summary);
        expect(payload, bug.id).not.toContain(bug.detail);
        expect(payload, bug.id).not.toContain(bug.id);
      }
    }
  });

  it('withholds it during grading too, because the host can reopen from there', () => {
    const state = meeting();
    const { team, seat } = seated(state);
    playQuestion(state, 1);
    submit(state, team, seat, 'O(n)', 'line 4', NOW);
    advance(state.meta, NOW);
    expect(state.meta.phase).toBe('grading');

    const view = buildPlayerView(state, team, seat, NOW);
    expect(view.reveal).toBeNull();
    // And the projector does not hold it either, for the same reason.
    expect(buildHostView(state, 'https://x.test', true, NOW).reveal).toBeNull();
  });

  it('hands it over once the answer is up', () => {
    const state = meeting();
    const { team, seat } = seated(state);
    playQuestion(state, 1);
    const question = QUESTIONS[1];
    const key = question === undefined ? null : answerFor(question.id);
    if (question === undefined || key === null) throw new Error('missing question');

    advance(state.meta, NOW); // -> grading
    advance(state.meta, NOW); // -> reveal

    const view = buildPlayerView(state, team, seat, NOW);
    expect(view.reveal?.complexity).toBe(key.complexity);
    expect(view.reveal?.bugs.map((b) => b.id)).toEqual(key.bugs.map((b) => b.id));
  });

  /**
   * A reopened question is only safe while nobody has seen the answer. `back` therefore
   * reopens from `grading` and steps to the previous question from `reveal`, and this is the
   * test that stops someone "simplifying" the two into one.
   */
  it('cannot be walked backwards into an open question after a reveal', () => {
    const state = meeting();
    seated(state);
    playQuestion(state, 2);
    advance(state.meta, NOW); // grading
    advance(state.meta, NOW); // reveal
    expect(state.meta.phase).toBe('reveal');

    back(state.meta, NOW);
    expect(state.meta.questionIndex).toBe(1);
    expect(state.meta.phase).toBe('reveal');
  });

  it('can be walked backwards out of grading, which reopens submissions', () => {
    const state = meeting();
    const { team, seat } = seated(state);
    playQuestion(state, 1);
    advance(state.meta, NOW);
    expect(state.meta.phase).toBe('grading');

    back(state.meta, NOW);
    expect(state.meta.phase).toBe('play');
    expect(submit(state, team, seat, 'O(n)', 'line 4 is wrong', NOW).ok).toBe(true);
  });
});

describe('teams', () => {
  it('gives each phone a number and reuses the lowest free one', () => {
    const state = meeting();
    const made = createTeam(state, 'TEAM');
    if (!made.ok) throw new Error('no team');

    const a = join(state, made.value.code, NOW);
    const b = join(state, made.value.code, NOW);
    const c = join(state, made.value.code, NOW);
    if (!a.ok || !b.ok || !c.ok) throw new Error('could not join');
    expect([a.value.seat, b.value.seat, c.value.seat]).toEqual(['1', '2', '3']);

    leave(state, b.value.sessionId);
    const d = join(state, made.value.code, NOW);
    expect(d.ok && d.value.seat).toBe('2');
  });

  it('holds a cap, and reclaims phones that have been gone two minutes', () => {
    const state = meeting();
    const made = createTeam(state, 'TEAM');
    if (!made.ok) throw new Error('no team');
    for (let i = 0; i < MAX_MEMBERS; i += 1) {
      expect(join(state, made.value.code, NOW).ok, `phone ${i}`).toBe(true);
    }
    expect(join(state, made.value.code, NOW).ok).toBe(false);
    // Five minutes later every one of those phones is stale, so a new one gets in.
    expect(join(state, made.value.code, NOW + 300_000).ok).toBe(true);
  });

  it('never recycles a join code, even after a team is gone', () => {
    const state = meeting();
    const first = createTeam(state, 'ONE');
    if (!first.ok) throw new Error('no team');
    delete state.teams[first.value.id];
    for (let i = 0; i < 40; i += 1) {
      const next = createTeam(state, `T${i}`);
      if (next.ok) expect(next.value.code).not.toBe(first.value.code);
    }
  });

  it('uniquifies a duplicate name rather than turning it away', () => {
    const state = meeting();
    const a = createTeam(state, 'SEGFAULT');
    const b = createTeam(state, 'SEGFAULT');
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.value.name).not.toBe(a.value.name);
  });

  it('refuses an unknown code and a malformed one differently from nothing at all', () => {
    const state = meeting();
    expect(join(state, '0123', NOW).ok).toBe(false);
    expect(join(state, '9999', NOW).ok).toBe(false);
    expect(resolve(state, null, NOW).ok).toBe(false);
    expect(resolve(state, 's_nope', NOW).ok).toBe(false);
  });
});

describe('answering', () => {
  it('is only possible while the question is open', () => {
    const state = meeting();
    const { team, seat } = seated(state);
    expect(submit(state, team, seat, 'O(n)', 'line 1', NOW).ok).toBe(false);

    playQuestion(state, 0);
    expect(submit(state, team, seat, 'O(n)', 'line 1', NOW).ok).toBe(true);

    advance(state.meta, NOW);
    expect(submit(state, team, seat, 'O(n)', 'line 1', NOW).ok).toBe(false);
  });

  it('belongs to the team, and the last one counts', () => {
    const state = meeting();
    const made = createTeam(state, 'TEAM');
    if (!made.ok) throw new Error('no team');
    const one = join(state, made.value.code, NOW);
    const two = join(state, made.value.code, NOW);
    if (!one.ok || !two.ok) throw new Error('could not join');
    playQuestion(state, 1);

    submit(state, made.value, one.value.seat, 'O(n)', 'first go', NOW);
    submit(state, made.value, two.value.seat, 'O(n log n)', 'second go', NOW + 1000);

    // Both phones see the same answer, and who sent it.
    for (const seat of [one.value.seat, two.value.seat]) {
      const view = buildPlayerView(state, made.value, seat, NOW);
      expect(view.answer?.complexity).toBe('O(n log n)');
      expect(view.answer?.findings).toBe('second go');
      expect(view.answer?.submittedBy).toBe(two.value.seat);
    }
  });

  it('clips and tidies what is written, and refuses an empty answer', () => {
    const state = meeting();
    const { team, seat } = seated(state);
    playQuestion(state, 1);

    expect(submit(state, team, seat, '   ', '  ', NOW).ok).toBe(false);

    const long = 'line 4 reads past the end. '.repeat(40);
    expect(submit(state, team, seat, 'O(n)   spaces   here', long, NOW).ok).toBe(true);
    const question = QUESTIONS[1];
    if (question === undefined) throw new Error('missing question');
    const play = teamQuestion(team, question);
    expect(play.findings.length).toBe(MAX_FINDINGS_CHARS);
    expect(play.complexity).toBe('O(n) spaces here');
  });

  it('records how long the team took, capped at the question length', () => {
    const state = meeting();
    const { team, seat } = seated(state);
    playQuestion(state, 1);
    const question = QUESTIONS[1];
    if (question === undefined) throw new Error('missing question');

    submit(state, team, seat, 'O(n)', 'line 4', NOW + 30_000);
    expect(teamQuestion(team, question).elapsedMs).toBe(30_000);

    submit(state, team, seat, 'O(n)', 'line 4', NOW + question.playMs + 60_000);
    expect(teamQuestion(team, question).elapsedMs).toBe(question.playMs);
  });
});

describe('closing a question', () => {
  it('settles the teams that never answered without troubling the grader', () => {
    const state = meeting();
    const answered = seated(state, 'ANSWERED');
    const quiet = seated(state, 'QUIET');
    playQuestion(state, 1);
    submit(state, answered.team, answered.seat, 'O(n)', 'line 4', NOW);

    closeQuestion(state, NOW);
    const question = QUESTIONS[1];
    if (question === undefined) throw new Error('missing question');

    // The quiet team is done — nothing to grade, nothing to pay for.
    expect(quiet.team.play[question.id]?.verdict?.status).toBe('empty');
    expect(quiet.team.play[question.id]?.verdict?.points).toBe(0);
    // The one that answered is left pending, for the grading pass to pick up.
    expect(answered.team.play[question.id]?.verdict).toBeNull();
  });

  it('leaves a verdict that has already been paid for alone', () => {
    const state = meeting();
    const { team, seat } = seated(state);
    playQuestion(state, 1);
    submit(state, team, seat, 'O(n)', 'line 4', NOW);
    const question = QUESTIONS[1];
    if (question === undefined) throw new Error('missing question');

    const play = teamQuestion(team, question);
    play.verdict = gradedVerdict(true, [], 'ok', 'claude-opus-5', NOW);
    closeQuestion(state, NOW + 1);
    expect(play.verdict.status).toBe('graded');
  });

  it('lets the host clear only the failures, and only those', () => {
    const state = meeting();
    const bad = seated(state, 'BAD');
    const good = seated(state, 'GOOD');
    playQuestion(state, 1);
    const question = QUESTIONS[1];
    if (question === undefined) throw new Error('missing question');

    teamQuestion(bad.team, question).verdict = failedVerdict('HTTP 500', NOW);
    teamQuestion(good.team, question).verdict = gradedVerdict(true, [], '', 'm', NOW);
    teamQuestion(bad.team, question).attempts = 2;

    expect(regrade(state)).toBe(1);
    expect(bad.team.play[question.id]?.verdict).toBeNull();
    expect(bad.team.play[question.id]?.attempts).toBe(0);
    expect(good.team.play[question.id]?.verdict?.status).toBe('graded');
  });
});

describe('the board', () => {
  it('adds up verdicts and ignores the warm-up', () => {
    const state = meeting();
    const { team, seat } = seated(state);
    const [warmUp, first] = QUESTIONS;
    if (warmUp === undefined || first === undefined) throw new Error('missing questions');

    playQuestion(state, 0);
    submit(state, team, seat, 'O(n)', 'everything', NOW);
    teamQuestion(team, warmUp).verdict = gradedVerdict(true, ['q0.uninit'], '', 'm', NOW);

    playQuestion(state, 1);
    submit(state, team, seat, 'O(n)', 'line 4', NOW);
    teamQuestion(team, first).verdict = gradedVerdict(true, ['q1.intdiv', 'q1.overflow'], '', 'm', NOW);

    const [row] = standingsOf(state);
    expect(row?.points).toBe(verdictPoints(true, 2));
    expect(row?.complexities).toBe(1);
    expect(row?.bugs).toBe(2);
  });

  it('counts, for each bug, how many teams found it', () => {
    const state = meeting();
    const a = seated(state, 'A');
    const b = seated(state, 'B');
    const c = seated(state, 'C');
    playQuestion(state, 1);
    const question = QUESTIONS[1];
    const key = question === undefined ? null : answerFor(question.id);
    if (question === undefined || key === null) throw new Error('missing question');
    const [firstBug, secondBug] = key.bugs;
    if (firstBug === undefined || secondBug === undefined) throw new Error('need two bugs');

    for (const t of [a, b, c]) submit(state, t.team, t.seat, 'O(n)', 'something', NOW);
    teamQuestion(a.team, question).verdict = gradedVerdict(true, [firstBug.id], '', 'm', NOW);
    teamQuestion(b.team, question).verdict = gradedVerdict(false, [firstBug.id, secondBug.id], '', 'm', NOW);
    teamQuestion(c.team, question).verdict = emptyVerdict(NOW);

    advance(state.meta, NOW); // grading
    advance(state.meta, NOW); // reveal

    const reveal = buildPlayerView(state, a.team, a.seat, NOW).reveal;
    expect(reveal?.complexityFoundBy).toBe(1);
    expect(reveal?.bugs.find((x) => x.id === firstBug.id)?.foundBy).toBe(2);
    expect(reveal?.bugs.find((x) => x.id === secondBug.id)?.foundBy).toBe(1);
    // And it marks which ones this team got, without telling them whose the others were.
    expect(reveal?.bugs.find((x) => x.id === firstBug.id)?.yours).toBe(true);
    expect(reveal?.bugs.find((x) => x.id === secondBug.id)?.yours).toBe(false);
  });

  it('is what the projector shows, and says when the grader is missing', () => {
    const state = meeting();
    seated(state, 'A');
    const view = buildHostView(state, 'https://autopsy.test', false, NOW);
    expect(view.graderReady).toBe(false);
    expect(view.joinUrl).toBe('https://autopsy.test');
    expect(view.room).toBe(ROOM);
    expect(view.teamCount).toBe(1);
    expect(view.memberCount).toBe(1);
  });

  /**
   * The board is unauthenticated and on a wall. A list of every team's join code published to
   * the room would tell forty strangers how to walk into each other's teams, so the row a
   * team occupies on the projector carries a name and a state and nothing that lets anyone in.
   */
  it('never publishes a team join code to the projector', () => {
    const state = meeting();
    const { team } = seated(state, 'A');
    const payload = JSON.stringify(buildHostView(state, 'https://x.test', true, NOW));
    expect(payload).not.toContain(team.code);
    expect(buildHostView(state, 'https://x.test', true, NOW).teams[0]).not.toHaveProperty('code');
    // The team's own phones still get it — that is how the rest of the team gets in.
    expect(buildPlayerView(state, team, '1', NOW).team.code).toBe(team.code);
  });

  it('tells the host how many answers are still owed a verdict', () => {
    const state = meeting();
    const a = seated(state, 'A');
    seated(state, 'B');
    playQuestion(state, 1);
    submit(state, a.team, a.seat, 'O(n)', 'line 4', NOW);
    closeQuestion(state, NOW);

    const view = buildHostView(state, 'https://x.test', true, NOW);
    expect(view.answeredCount).toBe(1);
    expect(view.pendingGrades).toBe(1);
    expect(view.failedGrades).toBe(0);
    expect(view.lastGradeError).toBeNull();
  });

  /**
   * The grader's excuse reaches the host and nobody else. At an event "invalid x-api-key" is
   * a different evening from "rate limited", and a count of three tells you neither.
   */
  it('hands the host the reason a verdict failed, and never hands it to a team', () => {
    const state = meeting();
    const { team, seat } = seated(state, 'A');
    playQuestion(state, 1);
    submit(state, team, seat, 'O(n)', 'line 4', NOW);
    const question = QUESTIONS[1];
    if (question === undefined) throw new Error('missing question');
    teamQuestion(team, question).verdict = failedVerdict('invalid x-api-key', NOW);

    expect(buildHostView(state, 'https://x.test', true, NOW).lastGradeError).toBe(
      'invalid x-api-key',
    );
    expect(JSON.stringify(buildPlayerView(state, team, seat, NOW))).not.toContain('x-api-key');
  });
});

describe('the clock', () => {
  it('pauses and resumes without losing what was left', () => {
    const state = meeting();
    playQuestion(state, 0);
    const remaining = (state.meta.phaseEndsAt ?? 0) - NOW;

    togglePause(state.meta, NOW + 10_000);
    expect(state.meta.phaseEndsAt).toBeNull();
    expect(state.meta.pausedWithMs).toBe(remaining - 10_000);

    togglePause(state.meta, NOW + 60_000);
    expect(state.meta.phaseEndsAt).toBe(NOW + 60_000 + remaining - 10_000);
  });

  it('takes a nudge while paused as well as while running', () => {
    const state = meeting();
    playQuestion(state, 0);
    nudge(state.meta, 30_000);
    const running = state.meta.phaseEndsAt ?? 0;

    togglePause(state.meta, NOW);
    nudge(state.meta, -30_000);
    togglePause(state.meta, NOW);
    expect(state.meta.phaseEndsAt).toBe(running - 30_000);
  });

  it('never goes below zero on the way down', () => {
    const state = meeting();
    playQuestion(state, 0);
    togglePause(state.meta, NOW);
    nudge(state.meta, -10 * 60_000);
    expect(state.meta.pausedWithMs).toBe(0);
  });

  it('keeps the room code through an erase, so the wall does not change', () => {
    const state = meeting();
    seated(state, 'A');
    playQuestion(state, 2);
    resetMeeting(state);
    expect(state.meta.room).toBe(ROOM);
    expect(state.meta.phase).toBe('lobby');
    expect(Object.keys(state.teams)).toEqual([]);
  });

  it('walks every question and then stops', () => {
    const state = meeting();
    for (const question of QUESTIONS) {
      advance(state.meta, NOW);
      expect(state.meta.phase).toBe('play');
      expect(state.meta.questionIndex).toBe(question.index);
      advance(state.meta, NOW);
      expect(state.meta.phase).toBe('grading');
      advance(state.meta, NOW);
      expect(state.meta.phase).toBe('reveal');
    }
    advance(state.meta, NOW);
    expect(state.meta.phase).toBe('done');
    advance(state.meta, NOW);
    expect(state.meta.phase).toBe('done');
  });
});
