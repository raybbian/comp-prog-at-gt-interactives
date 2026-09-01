/**
 * Talking to the worker.
 *
 * Same origin in every mode — the built client is served by the same worker that serves
 * `/api`, and in development Vite proxies `/api` across — so there is no base URL to
 * configure, no CORS, and no environment variable to ship set wrong.
 */

import type { ErrorCode } from '../protocol/codes.ts';

/**
 * Every request but minting belongs to one room, and a tab only ever has one: the board
 * talks to the meeting it opened, a phone to the meeting it joined. So the code is set
 * once at boot and read here, rather than threaded as an argument through every call,
 * every hook and every route that has no other reason to know about it.
 */
let room: string | null = null;

export function enterRoom(code: string): void {
  room = code;
}

export function apiBase(): string {
  return room === null ? '/api' : `/api/r/${room}`;
}

/** Minting is the one call that predates a room, so it names its own path. */
export async function openRoom(): Promise<Reply<{ room: string }>> {
  return request<{ room: string }>('/rooms', { method: 'POST' }, '/api');
}

const ROOM_KEY = 'cpatgt:telephone:room.v1';

export type Reply<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; message: string };

async function request<T>(path: string, init?: RequestInit, base = apiBase()): Promise<Reply<T>> {
  try {
    // The cookie is the primary credential, but a phone on a plain-HTTP origin refuses a
    // Secure cookie and iOS evicts cookies on its own schedule, so every request also
    // carries the session in a header. Fetch can do that; `EventSource` cannot, which is
    // why the stream still depends on the cookie and the polling fallback covers it.
    const session = recallSession();
    const response = await fetch(`${base}${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        ...(session === null ? {} : { 'x-tel-session': session }),
      },
    });
    const body: unknown = await response.json().catch(() => ({}));
    const record = (body ?? {}) as Record<string, unknown>;
    if (record['ok'] === true) return { ok: true, data: record as T };
    return {
      ok: false,
      error: (record['error'] as ErrorCode | undefined) ?? 'bad_request',
      message: typeof record['message'] === 'string' ? record['message'] : 'Something went wrong.',
    };
  } catch {
    return { ok: false, error: 'bad_request', message: 'No connection.' };
  }
}

/** `base` is only ever passed to reach a room this tab has not entered yet. */
export function get<T>(path: string, base?: string): Promise<Reply<T>> {
  return request<T>(path, undefined, base ?? apiBase());
}

export function post<T>(path: string, body: unknown = {}, base?: string): Promise<Reply<T>> {
  return request<T>(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    base ?? apiBase(),
  );
}

/**
 * Which room this browser is in.
 *
 * The board keeps its code in `sessionStorage` and a phone keeps its in `localStorage`,
 * and that difference is the whole feature. `sessionStorage` belongs to one tab: reloading
 * the board — or the projector cable being pulled — comes back to the same meeting, while
 * a second tab starts with an empty store and therefore opens a second meeting, which is
 * exactly what the code on screen promises. A phone must do the opposite and survive being
 * closed entirely, so it gets the store that outlives the tab.
 */
export type RoomScope = 'tab' | 'device';

function store(scope: RoomScope): Storage {
  return scope === 'tab' ? window.sessionStorage : window.localStorage;
}

export function rememberRoom(code: string, scope: RoomScope): void {
  try {
    store(scope).setItem(ROOM_KEY, code);
  } catch {
    // Private mode, or site data switched off. The code stays in the URL either way.
  }
}

export function recallRoom(scope: RoomScope): string | null {
  try {
    return store(scope).getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

export function forgetRoom(scope: RoomScope): void {
  try {
    store(scope).removeItem(ROOM_KEY);
  } catch {
    // Nothing to do; the server will refuse the room anyway.
  }
}

/**
 * The session id lives in a cookie *and* here.
 *
 * The cookie is what authenticates the event stream — `EventSource` cannot set a header,
 * and a token in the query string would land in every access log. This copy is what gets
 * the phone back in when iOS decides to evict the cookie, which it does.
 *
 * Keyed by room for the same reason the cookie is scoped to one: a phone that played in an
 * earlier meeting must not offer that meeting's session to this one and be told, at the
 * worst possible moment, that it has lost a seat it never had.
 */
function sessionKey(): string {
  return `cpatgt:telephone:session.${room ?? 'none'}`;
}

export function rememberSession(id: string): void {
  try {
    window.localStorage.setItem(sessionKey(), id);
  } catch {
    // Private mode, or a browser with site data switched off. The cookie still works.
  }
}

export function recallSession(): string | null {
  try {
    return window.localStorage.getItem(sessionKey());
  } catch {
    return null;
  }
}

export function forgetSession(): void {
  try {
    window.localStorage.removeItem(sessionKey());
  } catch {
    // Nothing to do; the server will refuse the session anyway.
  }
}

/** Client-generated so a retried send is recognised as the same message, not a new one. */
export function newMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The receiver's canvas, kept locally as well as on the server.
 *
 * A phone that locks and reloads mid-round must not lose five minutes of painting, and
 * the round trip to restore it from the server is one the player should never notice.
 */
export function stashGrid(roundId: string, grid: string): void {
  try {
    window.sessionStorage.setItem(`cpatgt:telephone:grid:${roundId}`, grid);
  } catch {
    // The server copy is authoritative; this is only a faster path back.
  }
}

export function unstashGrid(roundId: string): string | null {
  try {
    return window.sessionStorage.getItem(`cpatgt:telephone:grid:${roundId}`);
  } catch {
    return null;
  }
}
