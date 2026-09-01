import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from './client.ts';

/**
 * The verdict comes from the status line.
 *
 * These are cheap, and one of them is here because the alternative — reading `ok` out of
 * the body — shipped a lobby route that answered 200 with a perfectly good body and was
 * reported to the player as "Something went wrong."
 */
function answers(status: number, body: string, type = 'application/json'): void {
  globalThis.fetch = vi.fn(
    async () => new Response(body, { status, headers: { 'content-type': type } }),
  ) as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request', () => {
  it('takes a 2xx as success even with nothing enveloping the body', async () => {
    answers(200, JSON.stringify({ kind: 'lobby', teamCount: 3 }));
    const reply = await get<{ teamCount: number }>('/lobby');
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.data.teamCount).toBe(3);
  });

  it('carries the code and the wording up from a failure body', async () => {
    answers(404, JSON.stringify({ error: 'no_room', message: 'No meeting with that code.' }));
    const reply = await get('/lobby');
    expect(reply.ok).toBe(false);
    if (!reply.ok) {
      expect(reply.error).toBe('no_room');
      expect(reply.message).toBe('No meeting with that code.');
    }
  });

  // A 502 from in front of the worker is HTML, not JSON. It must not read as success, and
  // it must not claim to be a specific failure it knows nothing about.
  it('fails safely on a non-JSON error page', async () => {
    answers(502, '<html>Bad gateway</html>', 'text/html');
    const reply = await get('/view');
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.error).toBe('bad_request');
  });
});
