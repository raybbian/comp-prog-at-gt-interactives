import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBase, enterRoom, get } from './client.ts';

/**
 * The verdict comes from the status line.
 *
 * These are cheap, and the reason they are here is that the alternative — reading `ok` out
 * of the body — turns a route that answers 200 with a perfectly good unenveloped body into
 * "Something went wrong" in front of a player.
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

  // A 502 from in front of the worker is HTML, not JSON. It must not read as success, and it
  // must not claim to be a specific failure it knows nothing about.
  it('fails safely on a non-JSON error page', async () => {
    answers(502, '<html>Bad gateway</html>', 'text/html');
    const reply = await get('/view');
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.error).toBe('bad_request');
  });
});

describe('the room', () => {
  /**
   * Every path but minting hangs off the room, and it is read from a module variable rather
   * than passed down through every hook. Which means this is the one thing worth asserting
   * about it: entering a room changes where the requests go.
   */
  it('is what every path hangs off once it is entered', () => {
    enterRoom('482913');
    expect(apiBase()).toBe('/api/r/482913');
    enterRoom('100001');
    expect(apiBase()).toBe('/api/r/100001');
  });
});
