/**
 * The worker: one origin serving both the game and its API.
 *
 * `/api/*` goes to a meeting object; everything else is the built client. Keeping them
 * on one origin is not tidiness — sessions live in a cookie and in `localStorage`, both
 * of which are origin-scoped, so a second origin would mean every phone in the room
 * losing its seat at the same moment.
 *
 * A meeting is addressed by the room code on the projector rather than by a deploy-time
 * name. Opening the host screen starts a meeting and mints the code; opening it a second
 * time starts a second one. Nothing dedupes them and nothing needs to — the room types in
 * the code it can see, so the tab nobody joined is simply a tab nobody joined.
 */

import { json, problem } from './http.ts';

export { Meeting } from './meeting.ts';

type Env = {
  MEETING: DurableObjectNamespace;
  ASSETS: Fetcher;
};

/** `/api/r/<six digits>/<rest>`. A malformed code fails here, before an object exists. */
const ROOM = /^\/api\/r\/([1-9][0-9]{5})(\/.*)?$/;
const MINT_ATTEMPTS = 12;

function newRoomCode(): string {
  return String(100_000 + Math.floor(Math.random() * 900_000));
}

function room(env: Env, code: string): DurableObjectStub {
  return env.MEETING.get(env.MEETING.idFromName(`room:${code}`));
}

/**
 * Codes are claimed by the object itself rather than tracked in a registry.
 *
 * `idFromName` is deterministic, so asking the object a candidate code would name whether
 * it is already open *is* the question "is this code free", and it answers on its own
 * single thread. Two hosts hitting mint in the same second therefore cannot both be told
 * yes, and there is no lock, no registry object, and no second place for the truth to
 * live.
 */
async function mint(env: Env, origin: string): Promise<Response> {
  for (let attempt = 0; attempt < MINT_ATTEMPTS; attempt += 1) {
    const code = newRoomCode();
    const opened = await room(env, code).fetch(`${origin}/__open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room: code }),
    });
    if (opened.ok) return json({ room: code });
  }
  return problem('server_full', 'No room codes left.');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (url.pathname === '/api/rooms' && request.method === 'POST') return mint(env, url.origin);

    const match = ROOM.exec(url.pathname);
    if (match === null) return problem('bad_request', 'No such endpoint.');
    const [, code = '', rest = '/'] = match;

    // `__` is the worker's own conversation with the object. A client reaching one would
    // be asking to open a room that is, by definition, already open.
    if (rest.startsWith('/__')) return problem('bad_request', 'No such endpoint.');

    const inner = new URL(url);
    inner.pathname = rest;
    return room(env, code).fetch(new Request(inner, request));
  },
};
