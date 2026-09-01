/**
 * The meeting, as a Durable Object.
 *
 * One object per meeting, single-threaded and globally unique, so two phones on the same
 * team can never interleave halfway through a mutation and there is no locking to get
 * wrong. Durable storage sits underneath, which is why a restart mid-round picks up
 * where it left off instead of ending the club meeting.
 *
 * Everything interesting happens in `actions.ts` and `views.ts`. This file is transport:
 * routing, cookies, the event stream, storage, and the alarm that ends a round.
 *
 * An object exists for every name that has ever been fetched, so "does this room exist"
 * cannot be answered by whether the object is there — it is answered by whether the object
 * has ever been opened. Until then it refuses everything but `/__open`, which is what
 * stops a mistyped code from dropping a player into an empty meeting of their own.
 */


import type { AnyView, Lobby } from '../src/protocol/types.ts';
import {
  advance,
  back,
  closeRound,
  createTeam,
  join,
  leave,
  newSeed,
  nudge,
  paint,
  resetMeeting,
  resolve,
  sendMessage,
  submit,
  togglePause,
} from './actions.ts';
import {
  SESSION_COOKIE,
  SESSION_HEADER,
  SSE_HEADERS,
  bool,
  cookie,
  json,
  num,
  problem,
  readJson,
  setCookie,
  str,
} from './http.ts';
import { type State, type Team, freshMeta } from './state.ts';
import { buildHostView, buildReceiverView, buildSenderView } from './views.ts';

type Client = {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  sessionId: string | null;
  host: boolean;
  origin: string;
};

const encoder = new TextEncoder();
const SESSION_MAX_AGE = 6 * 60 * 60;
const HEARTBEAT_MS = 15_000;

export class Meeting implements DurableObject {
  #state: State;
  #clients = new Set<Client>();
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  /** Whether this code has ever been handed out as a room. */
  #open = false;

  constructor(private readonly ctx: DurableObjectState) {
    this.#state = { meta: freshMeta('000000', 'unopened'), teams: {} };
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
   * capped well below what twenty teams' message logs would come to by the end.
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
    const at = this.#state.meta.phaseEndsAt;
    if (at === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(at, now + 250));
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const at = this.#state.meta.phaseEndsAt;
    if (at === null || now + 250 < at) {
      await this.#rearm(now);
      return;
    }
    if (this.#state.meta.phase === 'play') closeRound(this.#state);
    advance(this.#state.meta, now);
    this.#touch();
    await this.#saveAll();
    await this.#rearm(now);
    this.#broadcast();
  }

  /* --------------------------------------------------------------- the stream */

  #viewFor(client: Client, now: number): AnyView | null {
    if (client.host) return buildHostView(this.#state, client.origin, now);
    const found = resolve(this.#state, client.sessionId, now);
    if (!found.ok) return null;
    return found.value.role === 'sender'
      ? buildSenderView(this.#state, found.value.team, now)
      : buildReceiverView(this.#state, found.value.team, now);
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
        // The seat was taken over. Tell that phone rather than leaving it staring at a
        // frozen screen wondering why nothing updates.
        void this.#push(client, 'event: revoked\ndata: {}\n\n').then(() => this.#drop(client));
        continue;
      }
      void this.#push(client, `id: ${this.#state.meta.v}\nevent: view\ndata: ${JSON.stringify(view)}\n\n`);
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

    // Cloudflare closes a proxied connection that goes quiet for around a hundred
    // seconds, and a team thinking hard is quiet for longer than that.
    if (this.#heartbeat === null) {
      this.#heartbeat = setInterval(() => {
        for (const c of this.#clients) void this.#push(c, ': hb\n\n');
      }, HEARTBEAT_MS);
    }

    const view = this.#viewFor(client, Date.now());
    void this.#push(
      client,
      `retry: 2000\n\n${view === null ? 'event: revoked\ndata: {}\n\n' : `id: ${this.#state.meta.v}\nevent: view\ndata: ${JSON.stringify(view)}\n\n`}`,
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

    /* --- opening the room -------------------------------------------------- */

    // Only the worker can reach this, and only once: the reply is what tells it whether
    // the code it picked was free.
    if (path === '/__open') {
      // Not a `problem()`: an internal-only failure has no business in the client's
      // `ErrorCode`, and the worker reads nothing here but the status.
      if (this.#open) return json({}, 409);
      this.#open = true;
      this.#state.meta = freshMeta(str(body, 'room'), newSeed());
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
        roundIndex: this.#state.meta.roundIndex < 0 ? null : this.#state.meta.roundIndex,
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
      const role = str(body, 'role') === 'sender' ? 'sender' : 'receiver';
      const joined = join(this.#state, str(body, 'code'), role, bool(body, 'takeover'), now);
      if (!joined.ok) {
        const team = this.#state.teams[this.#state.meta.codes[str(body, 'code')] ?? ''];
        const seat = team?.[role] ?? null;
        return problem(joined.error, joined.message, {
          occupiedSince: seat?.claimedAt ?? null,
          lastSeenAt: seat?.lastSeenAt ?? null,
        });
      }
      this.#touch();
      await this.#save(joined.value.team);
      this.#broadcast();
      const view =
        role === 'sender'
          ? buildSenderView(this.#state, joined.value.team, now)
          : buildReceiverView(this.#state, joined.value.team, now);
      return json(
        { sessionId: joined.value.sessionId, role, view },
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
     * Deliberately unauthenticated. The board is a projector in a room the host is
     * standing in, and the only thing a key ever bought was stopping someone in that room
     * from opening the same URL — a social problem, priced at a Cloudflare secret that had
     * to be set before the one evening it mattered. What a stranger must not be handed is
     * a live team's join code, and that is `buildHostView`'s job, not a gate's.
     */
    if (path.startsWith('/host/')) {
      if (path === '/host/view') return json({ view: buildHostView(this.#state, url.origin, now) });
      if (path === '/host/events') return this.#stream(request, null, true);

      if (path === '/host/control' && request.method === 'POST') {
        const action = str(body, 'action');
        if (action === 'next') advance(this.#state.meta, now);
        else if (action === 'back') back(this.#state.meta, now);
        else if (action === 'pause') togglePause(this.#state.meta, now);
        else if (action === 'nudge') nudge(this.#state.meta, num(body, 'ms', 30_000));
        else return problem('bad_request', 'Unknown control.');

        if (action === 'next' && this.#state.meta.phase === 'reveal') closeRound(this.#state);
        this.#touch();
        await this.#saveAll();
        await this.#rearm(now);
        this.#broadcast();
        return json({ view: buildHostView(this.#state, url.origin, now) });
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
        resetMeeting(this.#state, newSeed());
        await this.ctx.storage.deleteAll();
        await this.#saveAll();
        this.#broadcast();
        return json({ view: buildHostView(this.#state, url.origin, now) });
      }
      return problem('bad_request', 'No such endpoint.');
    }

    /* --- players ----------------------------------------------------------- */

    const bodySession = str(body, 'sessionId');
    const active = resolve(this.#state, sessionId ?? (bodySession === '' ? null : bodySession), now);

    if (path === '/rejoin' && request.method === 'POST') {
      if (!active.ok) return problem(active.error, active.message);
      const id = sessionId ?? bodySession;
      const view =
        active.value.role === 'sender'
          ? buildSenderView(this.#state, active.value.team, now)
          : buildReceiverView(this.#state, active.value.team, now);
      return json({ sessionId: id, role: active.value.role, view }, 200, {
        'set-cookie': setCookie(SESSION_COOKIE, id, SESSION_MAX_AGE, secure, base),
      });
    }

    if (!active.ok) return problem(active.error, active.message);
    const { team, role } = active.value;
    const viewNow = (): AnyView =>
      role === 'sender'
        ? buildSenderView(this.#state, team, Date.now())
        : buildReceiverView(this.#state, team, Date.now());

    if (path === '/view') return json({ view: viewNow() });
    if (path === '/events') return this.#stream(request, sessionId, false);

    if (path === '/messages' && request.method === 'POST') {
      const sent = sendMessage(
        this.#state,
        team,
        role,
        str(body, 'body'),
        str(body, 'clientMsgId'),
        now,
      );
      if (!sent.ok) return problem(sent.error, sent.message);
      this.#touch();
      await this.#save(team);
      this.#broadcast();
      return json({ seq: sent.value.seq, view: viewNow() });
    }

    if (path === '/grid' && request.method === 'POST') {
      const painted = paint(this.#state, team, role, str(body, 'grid'), now);
      if (!painted.ok) return problem(painted.error, painted.message);
      this.#touch();
      await this.#save(team);
      this.#broadcast();
      return json({ rev: painted.value.rev, view: viewNow() });
    }

    if (path === '/submit' && request.method === 'POST') {
      const done = submit(this.#state, team, role, now);
      if (!done.ok) return problem(done.error, done.message);
      this.#touch();
      await this.#save(team);
      this.#broadcast();
      return json({ solved: done.value.solved, view: viewNow() });
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

