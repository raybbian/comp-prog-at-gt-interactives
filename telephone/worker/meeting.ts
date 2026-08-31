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
 */


import type { AnyView, Lobby } from '../src/protocol/types.ts';
import {
  advance,
  back,
  closeRound,
  createTeam,
  join,
  leave,
  newHostKey,
  nudge,
  paint,
  resetMeeting,
  resolve,
  sendMessage,
  submit,
  togglePause,
} from './actions.ts';
import {
  HOST_COOKIE,
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

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: { HOST_KEY?: string },
  ) {
    this.#state = { meta: freshMeta(newHostKey(), 'unseeded'), teams: {} };
    ctx.blockConcurrencyWhile(async () => {
      await this.#load();
    });
  }

  async #load(): Promise<void> {
    const stored = await this.ctx.storage.list<unknown>();
    const meta = stored.get('meta');
    if (meta !== undefined) {
      this.#state.meta = meta as State['meta'];
    } else {
      const generated = this.env.HOST_KEY ?? newHostKey();
      this.#state.meta = freshMeta(generated, newHostKey());
      if (this.env.HOST_KEY === undefined) {
        // Otherwise the key exists only inside this object and the host can never open
        // the board. Set HOST_KEY as a secret in production; this line is the escape
        // hatch, and shows up in `wrangler tail` and in the dev console.
        console.log(`telephone: host board at /#/host?k=${generated}`);
      }
    }
    // A host key from the environment survives even a wiped object, so the projector's
    // link does not change under the host mid-meeting.
    if (this.env.HOST_KEY !== undefined) this.#state.meta.hostKey = this.env.HOST_KEY;

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
    const isHost =
      cookie(request, HOST_COOKIE) === this.#state.meta.hostKey ||
      request.headers.get(SESSION_HEADER) === this.#state.meta.hostKey;
    const body = request.method === 'POST' ? await readJson(request) : {};

    /* --- open to anyone ---------------------------------------------------- */

    if (path === '/lobby') {
      const lobby: Lobby = {
        kind: 'lobby',
        serverTime: now,
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
      return json({ ok: true, teamId: made.value.id, name: made.value.name, code: made.value.code });
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
        { ok: true, sessionId: joined.value.sessionId, role, view },
        200,
        { 'set-cookie': setCookie(SESSION_COOKIE, joined.value.sessionId, SESSION_MAX_AGE, secure) },
      );
    }

    /* --- host -------------------------------------------------------------- */

    if (path === '/host/claim' && request.method === 'POST') {
      if (str(body, 'hostKey') !== this.#state.meta.hostKey) {
        return problem('not_host', 'Not found.');
      }
      return json({ ok: true, view: buildHostView(this.#state, url.origin, now) }, 200, {
        'set-cookie': setCookie(HOST_COOKIE, this.#state.meta.hostKey, SESSION_MAX_AGE, secure),
      });
    }

    if (path.startsWith('/host/')) {
      if (!isHost) return problem('not_host', 'Not found.');

      if (path === '/host/view') return json({ ok: true, view: buildHostView(this.#state, url.origin, now) });
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
        return json({ ok: true, view: buildHostView(this.#state, url.origin, now) });
      }

      if (path === '/host/reset' && request.method === 'POST') {
        if (num(body, 'confirmTeamCount', -1) !== Object.keys(this.#state.teams).length) {
          return problem('bad_request', 'Team count did not match.');
        }
        resetMeeting(this.#state, newHostKey());
        await this.ctx.storage.deleteAll();
        await this.#saveAll();
        this.#broadcast();
        return json({ ok: true, view: buildHostView(this.#state, url.origin, now) });
      }
      return problem('not_host', 'Not found.');
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
      return json({ ok: true, sessionId: id, role: active.value.role, view }, 200, {
        'set-cookie': setCookie(SESSION_COOKIE, id, SESSION_MAX_AGE, secure),
      });
    }

    if (!active.ok) return problem(active.error, active.message);
    const { team, role } = active.value;
    const viewNow = (): AnyView =>
      role === 'sender'
        ? buildSenderView(this.#state, team, Date.now())
        : buildReceiverView(this.#state, team, Date.now());

    if (path === '/view') return json({ ok: true, view: viewNow() });
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
      return json({ ok: true, seq: sent.value.seq, view: viewNow() });
    }

    if (path === '/grid' && request.method === 'POST') {
      const painted = paint(this.#state, team, role, str(body, 'grid'), now);
      if (!painted.ok) return problem(painted.error, painted.message);
      this.#touch();
      await this.#save(team);
      this.#broadcast();
      return json({ ok: true, rev: painted.value.rev, view: viewNow() });
    }

    if (path === '/submit' && request.method === 'POST') {
      const done = submit(this.#state, team, role, now);
      if (!done.ok) return problem(done.error, done.message);
      this.#touch();
      await this.#save(team);
      this.#broadcast();
      return json({ ok: true, solved: done.value.solved, view: viewNow() });
    }

    if (path === '/leave' && request.method === 'POST') {
      if (sessionId !== null) leave(this.#state, sessionId);
      this.#touch();
      await this.#save(team);
      this.#broadcast();
      return json({ ok: true });
    }

    return problem('bad_request', 'No such endpoint.');
  }
}

