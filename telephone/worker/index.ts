/**
 * The worker: one origin serving both the game and its API.
 *
 * `/api/*` goes to the meeting object; everything else is the built client. Keeping them
 * on one origin is not tidiness — sessions live in a cookie and in `localStorage`, both
 * of which are origin-scoped, so a second origin would mean every phone in the room
 * losing its seat at the same moment.
 */

export { Meeting } from './meeting.ts';

type Env = {
  MEETING: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** Which meeting this deployment is running. A new name is a clean slate. */
  MEETING_ID?: string;
  HOST_KEY?: string;
};

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const id = env.MEETING.idFromName(env.MEETING_ID ?? 'default');
    return env.MEETING.get(id).fetch(request);
  },
};
