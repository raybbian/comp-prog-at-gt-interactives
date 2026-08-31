/**
 * Talking to the worker.
 *
 * Same origin in every mode — the built client is served by the same worker that serves
 * `/api`, and in development Vite proxies `/api` across — so there is no base URL to
 * configure, no CORS, and no environment variable to ship set wrong.
 */

import type { ErrorCode } from '../protocol/codes.ts';

export const API = '/api';

const SESSION_KEY = 'cpatgt:telephone:session.v1';

export type Reply<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; message: string };

async function request<T>(path: string, init?: RequestInit): Promise<Reply<T>> {
  try {
    // The cookie is the primary credential, but a phone on a plain-HTTP origin refuses a
    // Secure cookie and iOS evicts cookies on its own schedule, so every request also
    // carries the session in a header. Fetch can do that; `EventSource` cannot, which is
    // why the stream still depends on the cookie and the polling fallback covers it.
    const session = recallSession();
    const response = await fetch(`${API}${path}`, {
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

export function get<T>(path: string): Promise<Reply<T>> {
  return request<T>(path);
}

export function post<T>(path: string, body: unknown = {}): Promise<Reply<T>> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * The session id lives in a cookie *and* here.
 *
 * The cookie is what authenticates the event stream — `EventSource` cannot set a header,
 * and a token in the query string would land in every access log. This copy is what gets
 * the phone back in when iOS decides to evict the cookie, which it does.
 */
export function rememberSession(id: string): void {
  try {
    window.localStorage.setItem(SESSION_KEY, id);
  } catch {
    // Private mode, or a browser with site data switched off. The cookie still works.
  }
}

export function recallSession(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function forgetSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
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
