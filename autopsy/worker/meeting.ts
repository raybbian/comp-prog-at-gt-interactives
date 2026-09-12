/**
 * The meeting, as a Durable Object.
 *
 * One object per meeting, single-threaded and globally unique, so four phones on the same
 * team can never interleave halfway through a mutation and there is no locking to get
 * wrong. Durable storage sits underneath, which is why a restart mid-question picks up
 * where it left off instead of ending the club meeting.
 *
 * Everything interesting happens in `actions.ts`, `views.ts` and `grader.ts`. This file is
 * transport: routing, cookies, the event stream, storage, the alarm that closes a question,
 * and the loop that gets twenty answers graded before the room notices.
 *
 * An object exists for every name that has ever been fetched, so "does this room exist"
 * cannot be answered by whether the object is there — it is answered by whether the object
 * has ever been opened. Until then it refuses everything but `/__open`, which is what stops
 * a mistyped code from dropping a player into an empty meeting of their own.
 */

import type { AnyView, Lobby } from '../src/protocol/types.ts';
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
import { gradeSubmission, graderReady, type GraderEnv } from './grader.ts';
import {
  SESSION_COOKIE,
  SESSION_HEADER,
  SSE_HEADERS,
  cookie,
  json,
  num,
  problem,
  readJson,
  setCookie,
  str,
} from './http.ts';
import {
  type State,
  type Team,
  type TeamQuestion,
  currentQuestion,
  failedVerdict,
  freshMeta,
  gradedVerdict,
  hasSubmission,
} from './state.ts';
import { buildHostView, buildPlayerView } from './views.ts';

type Client = {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  sessionId: string | null;
  host: boolean;
  origin: string;
};

type Env = GraderEnv;

const encoder = new TextEncoder();
const SESSION_MAX_AGE = 6 * 60 * 60;
const HEARTBEAT_MS = 15_000;

/**
 * How many answers are in flight at once, and how many times one may be tried.
 *
 * Four at a time is enough to get twenty verdicts inside the grading phase and small
 * enough not to walk into a rate limit with the whole room watching. Two attempts,
 * because the second one is the one that catches a blip and the third would only spend
 * money confirming that the key is wrong — the host's regrade key covers the rest.
 */
const GRADE_CONCURRENCY = 4;
const GRADE_ATTEMPTS = 2;
/** While grading, the alarm comes back this often to make sure the pass is still running. */
const GRADE_POLL_MS = 2500;

export class Meeting implements DurableObject {
  #state: State;
  #clients = new Set<Client>();
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  /** Reentrancy guard: the alarm and the request path both want to start a pass. */
  #grading = false;
  /** Whether this code has ever been handed out as a room. */
  #open = false;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {
    this.#state = { meta: freshMeta('000000'), teams: {} };
    ctx.blockConcurrencyWhile(async () => {
      await this.#load();
    });
  }

  async #load(): Promise<void> {
    const stored = await this.ctx.storage.list<unknown>();
    const meta = stored.get('meta');
    this.#open = meta !== undefined;
    if (meta !== undefined) this.#state.meta = meta as State['meta'];

    for (const [key, value] of stored) {
      if (key.startsWith('team:')) this.#state.teams[key.slice(5)] = value as Team;
    }
    await this.#rearm(Date.now());
  }

  /**
   * Teams are stored one key at a time rather than as one blob: a Durable Object value is
   * capped well below what twenty teams' answers and verdicts come to by the end.
   */
  async #save(team?: Team): Promise<void> {
    const patch: Record<string, unknown> = { meta: this.#state.meta };
    if (team !== undefined) patch[`team:${team.id}`] = team;
    await this.ctx.storage.put(patch);
  }

  async #saveAll(): Promise<void> {
    const patch: Record<string, unknown> = { meta: this.#state.meta };
    for (const team of Object.values(this.#state.teams)) patch[`team:${team.id}`] = team;
    await this.ctx.storage.put(patch);
  }

  #touch(): void {
    this.#state.meta.v += 1;
  }

  /* ----------------------------------------------------------------- the clock */

  async #rearm(now: number): Promise<void> {
    const deadline = this.#state.meta.phaseEndsAt;
    // In `grading` the alarm has two jobs: the cap that eventually gives up, and a poll
    // that restarts the pass if this object was evicted while the model was thinking.
    // That poll is the only thing making a paid-for verdict durable, so it wins.
    const polling = this.#state.meta.phase === 'grading';
    const at = polling
      ? Math.min(deadline ?? Infinity, now + GRADE_POLL_MS)
      : (deadline ?? null);

    if (at === null || at === Infinity) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(at, now + 250));
  }

  async alarm(): Promise<void> {
    const now = Date.now();

    if (this.#state.meta.phase === 'grading') {
      await this.#gradePass();
      await this.#rearm(Date.now());
      return;
    }

    const at = this.#state.meta.phaseEndsAt;
    if (at === null || now + 250 < at) {
      await this.#rearm(now);
      return;
    }
    // The clock ran out on a question. Close it and start grading.
    if (this.#state.meta.phase === 'play') {
      closeQuestion(this.#state, now);
      advance(this.#state.meta, now);
      this.#touch();
      await this.#saveAll();
      this.#broadcast();
      await this.#rearm(Date.now());
      void this.#gradePass();
      return;
    }
    advance(this.#state.meta, now);
    this.#touch();
    await this.#saveAll();
    await this.#rearm(now);
    this.#broadcast();
  }

  /* ---------------------------------------------------------------- the grader */

  /** Answers still owed a verdict, oldest question state first. */
  #pending(): Array<{ team: Team; play: TeamQuestion }> {
    const question = currentQuestion(this.#state.meta);
    if (question === null) return [];
    const out: Array<{ team: Team; play: TeamQuestion }> = [];
    for (const team of Object.values(this.#state.teams)) {
      const play = team.play[question.id];
      if (play === undefined || play.verdict !== null) continue;
      if (!hasSubmission(play)) continue;
      if (play.attempts >= GRADE_ATTEMPTS) continue;
      out.push({ team, play });
    }
    return out;
  }

  /**
   * Grade everything outstanding, a few at a time, saving and broadcasting as verdicts land
   * so the board fills in rather than jumping.
   *
   * Not awaited by the request that starts it — a host pressing the arrow key must not wait
   * for twenty model calls — but the object stays alive because the alarm keeps coming back
   * while the phase is `grading`. That is also what makes it survive eviction: the work to
   * do is derived from stored state every time, never held in a variable.
   *
   * **One attempt per answer per pass.** A pass takes the jobs that were pending when it
   * started and does not re-collect, so a second attempt necessarily waits for the next
   * alarm. That poll interval *is* the backoff: retrying a failed call in the same tight
   * loop would spend both attempts inside the same blip, which is the one case where a
   * retry was supposed to help. It is also what lets the next pass pick up an answer a
   * team resubmitted after the host reopened the question.
   */
  async #gradePass(): Promise<void> {
    if (this.#grading) return;
    this.#grading = true;
    try {
      const question = currentQuestion(this.#state.meta);
      const key = question === null ? null : answerFor(question.id);
      if (question === null || key === null) return;

      const jobs = this.#pending();
      for (let start = 0; start < jobs.length; start += GRADE_CONCURRENCY) {
        const batch = jobs.slice(start, start + GRADE_CONCURRENCY);
        for (const job of batch) job.play.attempts += 1;

        const results = await Promise.all(
          batch.map((job) =>
            gradeSubmission(this.env, question, key, {
              complexity: job.play.complexity,
              findings: job.play.findings,
            }),
          ),
        );

        const now = Date.now();
        batch.forEach((job, i) => {
          const result = results[i];
          if (result === undefined) return;
          if (result.ok) {
            job.play.verdict = gradedVerdict(
              result.complexityCorrect,
              result.bugIds,
              result.note,
              result.model,
              now,
            );
          } else if (job.play.attempts >= GRADE_ATTEMPTS) {
            // Out of attempts. Recorded as failed rather than left pending, so the host
            // sees a number to act on instead of a phase that never ends.
            job.play.verdict = failedVerdict(result.reason, now);
          }
        });

        this.#touch();
        await this.#saveAll();
        this.#broadcast();
      }

      // Everything that can be graded has been. Put the answer up without waiting for the
      // cap — the whole reason grading is its own phase is that it ends when it ends.
      if (this.#state.meta.phase === 'grading' && this.#pending().length === 0) {
        advance(this.#state.meta, Date.now());
        this.#touch();
        await this.#saveAll();
        await this.#rearm(Date.now());
        this.#broadcast();
      }
    } finally {
      this.#grading = false;
    }
  }

  /* --------------------------------------------------------------- the stream */

  #viewFor(client: Client, now: number): AnyView | null {
    if (client.host) {
      return buildHostView(this.#state, client.origin, graderReady(this.env), now);
    }
    const found = resolve(this.#state, client.sessionId, now);
    if (!found.ok) return null;
    return buildPlayerView(this.#state, found.value.team, found.value.seat, now);
  }

  async #push(client: Client, chunk: string): Promise<void> {
    try {
      await client.writer.write(encoder.encode(chunk));
    } catch {
      this.#drop(client);
    }
  }

  #drop(client: Client): void {
    this.#clients.delete(client);
    void client.writer.close().catch(() => undefined);
    if (this.#clients.size === 0 && this.#heartbeat !== null) {
      clearInterval(this.#heartbeat);
      this.#heartbeat = null;
    }
  }

  #broadcast(): void {
    const now = Date.now();
    for (const client of this.#clients) {
      const view = this.#viewFor(client, now);
      if (view === null) {
        // The session is gone. Tell that phone rather than leaving it staring at a frozen
        // screen wondering why nothing updates.
        void this.#push(client, 'event: revoked\ndata: {}\n\n').then(() => this.#drop(client));
        continue;
      }
      void this.#push(
        client,
        `id: ${this.#state.meta.v}\nevent: view\ndata: ${JSON.stringify(view)}\n\n`,
      );
    }
  }

  #stream(request: Request, sessionId: string | null, host: boolean): Response {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const client: Client = {
      writer: writable.getWriter(),
      sessionId,
      host,
      origin: new URL(request.url).origin,
    };
    this.#clients.add(client);

    // Cloudflare closes a proxied connection that goes quiet for around a hundred seconds,
    // and a team reading a snippet is quiet for longer than that.
    if (this.#heartbeat === null) {
      this.#heartbeat = setInterval(() => {
        for (const c of this.#clients) void this.#push(c, ': hb\n\n');
      }, HEARTBEAT_MS);
    }

    const view = this.#viewFor(client, Date.now());
    void this.#push(
      client,
      `retry: 2000\n\n${
        view === null
          ? 'event: revoked\ndata: {}\n\n'
          : `id: ${this.#state.meta.v}\nevent: view\ndata: ${JSON.stringify(view)}\n\n`
      }`,
    );
    return new Response(readable, { headers: SSE_HEADERS });
  }

  /* ------------------------------------------------------------------ routing */

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const now = Date.now();
    const secure = url.protocol === 'https:';
    // Cookie first, header second. The header is what keeps a phone working when the
    // cookie was refused; the cookie is what keeps the event stream working, since
    // `EventSource` cannot send a header.
    const sessionId = cookie(request, SESSION_COOKIE) ?? request.headers.get(SESSION_HEADER);
    const body = request.method === 'POST' ? await readJson(request) : {};
    const hostView = (): AnyView =>
      buildHostView(this.#state, url.origin, graderReady(this.env), Date.now());

    /* --- opening the room -------------------------------------------------- */

    // Only the worker can reach this, and only once: the reply is what tells it whether the
    // code it picked was free.
    if (path === '/__open') {
      // Not a `problem()`: an internal-only failure has no business in the client's
      // `ErrorCode`, and the worker reads nothing here but the status.
      if (this.#open) return json({}, 409);
      this.#open = true;
      this.#state.meta = freshMeta(str(body, 'room'));
      await this.#save();
      return json({ room: this.#state.meta.room });
    }

    if (!this.#open) return problem('no_room', 'No meeting with that code.');

    const base = `/api/r/${this.#state.meta.room}`;

    /* --- open to anyone ---------------------------------------------------- */

    if (path === '/lobby') {
      const lobby: Lobby = {
        kind: 'lobby',
        serverTime: now,
        room: this.#state.meta.room,
        phase: this.#state.meta.phase,
        teamCount: Object.keys(this.#state.teams).length,
        joinOpen: this.#state.meta.phase !== 'done',
      };
      return json(lobby);
    }

    if (path === '/teams' && request.method === 'POST') {
      const made = createTeam(this.#state, str(body, 'name'));
      if (!made.ok) return problem(made.error, made.message);
      this.#touch();
      await this.#save(made.value);
      this.#broadcast();
      return json({ teamId: made.value.id, name: made.value.name, code: made.value.code });
    }

    if (path === '/join' && request.method === 'POST') {
      const joined = join(this.#state, str(body, 'code'), now);
      if (!joined.ok) return problem(joined.error, joined.message);
      this.#touch();
      await this.#save(joined.value.team);
      this.#broadcast();
      return json(
        {
          sessionId: joined.value.sessionId,
          seat: joined.value.seat,
          view: buildPlayerView(this.#state, joined.value.team, joined.value.seat, now),
        },
        200,
        {
          'set-cookie': setCookie(
            SESSION_COOKIE,
            joined.value.sessionId,
            SESSION_MAX_AGE,
            secure,
            base,
          ),
        },
      );
    }

    /* --- host -------------------------------------------------------------- */

    /*
     * Deliberately unauthenticated. The board is a projector in a room the host is standing
     * in, and the only thing a key ever bought was stopping someone in that room from
     * opening the same URL — a social problem, priced at a Cloudflare secret that had to be
     * set before the one evening it mattered. What a stranger must not be handed is a live
     * team's join code, and that is `buildHostView`'s job, not a gate's.
     */
    if (path.startsWith('/host/')) {
      if (path === '/host/view') return json({ view: hostView() });
      if (path === '/host/events') return this.#stream(request, null, true);

      if (path === '/host/control' && request.method === 'POST') {
        const action = str(body, 'action');
        if (action === 'next') {
          // Advancing out of `play` closes the question first, so every team's last
          // submission is the one that gets graded.
          if (this.#state.meta.phase === 'play') closeQuestion(this.#state, now);
          advance(this.#state.meta, now);
        } else if (action === 'back') back(this.#state.meta, now);
        else if (action === 'pause') togglePause(this.#state.meta, now);
        else if (action === 'nudge') nudge(this.#state.meta, num(body, 'ms', 30_000));
        else if (action === 'regrade') regrade(this.#state);
        else return problem('bad_request', 'Unknown control.');

        this.#touch();
        await this.#saveAll();
        await this.#rearm(now);
        this.#broadcast();
        // Fire and forget: the host's key press must not wait on a model, and the alarm
        // will pick the pass up again if this object goes away mid-flight.
        if (this.#state.meta.phase === 'grading') void this.#gradePass();
        return json({ view: hostView() });
      }

      if (path === '/host/reset' && request.method === 'POST') {
        const teams = Object.keys(this.#state.teams).length;
        if (num(body, 'confirmTeamCount', -1) !== teams) {
          // A team joining between the board's last update and the keypress is enough to
          // land here, so the message has to say what to do rather than just "no".
          return problem(
            'bad_request',
            `The board has ${teams} teams now, not what this screen was showing. Nothing was erased — try again.`,
          );
        }
        resetMeeting(this.#state);
        await this.ctx.storage.deleteAll();
        // The room code survives an erase, so the digits on the wall stay the digits on the
        // wall — and `#open` stays true, so the room does not 404 under the host.
        await this.#saveAll();
        this.#broadcast();
        return json({ view: hostView() });
      }
      return problem('bad_request', 'No such endpoint.');
    }

    /* --- players ----------------------------------------------------------- */

    const bodySession = str(body, 'sessionId');
    const active = resolve(this.#state, sessionId ?? (bodySession === '' ? null : bodySession), now);

    if (path === '/rejoin' && request.method === 'POST') {
      if (!active.ok) return problem(active.error, active.message);
      const id = sessionId ?? bodySession;
      return json(
        {
          sessionId: id,
          seat: active.value.seat,
          view: buildPlayerView(this.#state, active.value.team, active.value.seat, now),
        },
        200,
        { 'set-cookie': setCookie(SESSION_COOKIE, id, SESSION_MAX_AGE, secure, base) },
      );
    }

    if (!active.ok) return problem(active.error, active.message);
    const { team, seat } = active.value;
    const viewNow = (): AnyView => buildPlayerView(this.#state, team, seat, Date.now());

    if (path === '/view') return json({ view: viewNow() });
    if (path === '/events') return this.#stream(request, sessionId, false);

    if (path === '/answer' && request.method === 'POST') {
      const done = submit(
        this.#state,
        team,
        seat,
        str(body, 'complexity'),
        str(body, 'findings'),
        now,
      );
      if (!done.ok) return problem(done.error, done.message);
      this.#touch();
      await this.#save(team);
      this.#broadcast();
      return json({ view: viewNow() });
    }

    if (path === '/leave' && request.method === 'POST') {
      if (sessionId !== null) leave(this.#state, sessionId);
      this.#touch();
      await this.#save(team);
      this.#broadcast();
      return json({});
    }

    return problem('bad_request', 'No such endpoint.');
  }
}
