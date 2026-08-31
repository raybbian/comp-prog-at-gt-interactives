/** Request and response plumbing. The only place that knows about headers. */

import type { ErrorCode } from '../src/protocol/codes.ts';

export const SESSION_COOKIE = 'tel_s';
export const HOST_COOKIE = 'tel_h';

/**
 * Fetch can set a header; `EventSource` cannot. So the session travels as a cookie for
 * the stream and as this header for everything else — which means the game still works
 * on a phone that drops the cookie entirely, falling back to polling. iOS does drop it,
 * and so does any plain-HTTP origin that is not localhost.
 */
export const SESSION_HEADER = 'x-tel-session';

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

const STATUS: Partial<Record<ErrorCode, number>> = {
  bad_request: 400,
  bad_code: 404,
  bad_message: 400,
  bad_grid: 400,
  name_required: 400,
  seat_taken: 409,
  unknown_session: 404,
  wrong_role: 403,
  round_not_running: 409,
  nothing_received: 409,
  already_submitted: 409,
  too_fast: 429,
  // Never advertise the host surface to someone poking at it.
  not_host: 404,
  round_running: 409,
  server_full: 503,
};

export function problem(error: ErrorCode, message: string, extra: unknown = {}): Response {
  return json({ ok: false, error, message, ...(extra as object) }, STATUS[error] ?? 400);
}

export function cookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (header === null) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * `HttpOnly` because this value is what authenticates the event stream, and `EventSource`
 * cannot set a header — the alternative is a bearer token in the query string, which
 * lands in every access log and every `Referer`. The client keeps its own copy in
 * `localStorage` for when iOS evicts the cookie.
 */
export function setCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  // `Secure` is right in production and fatal in local testing: a browser rejects a
  // Secure cookie over plain HTTP, and `http://<laptop-ip>:5176` on a phone is plain
  // HTTP. (`localhost` is exempt, which is exactly why this only ever broke on a phone.)
  const flags = `Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`;
  return `${name}=${encodeURIComponent(value)}; ${flags}`;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  // A wedged client retrying with a huge body should not be able to cost us anything.
  const text = (await request.text()).slice(0, 8192);
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

export function bool(source: Record<string, unknown>, key: string): boolean {
  return source[key] === true;
}

export function num(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export const SSE_HEADERS = {
  'content-type': 'text/event-stream; charset=utf-8',
  // `no-transform` is the one that matters: it forbids any intermediary from compressing
  // or rewriting the body, which is the actual mechanism behind a buffered event stream.
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
} as const;
