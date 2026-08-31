import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnyView } from '../protocol/types.ts';
import { API, type Reply, get, post } from '../transport/client.ts';

/**
 * Keeping a screen in step with the meeting.
 *
 * The mental model that keeps this honest: **`GET /api/view` is how a client learns the
 * state, and the event stream is a latency optimisation that lets it skip a poll.** Both
 * return the identical payload — a full snapshot of everything that session may see,
 * never a delta — so there is one code path to test, a dropped event cannot desync
 * anyone, and a reconnect needs no replay buffer because the first event after it *is*
 * the truth. Forty phones polling every three seconds would carry the whole event on
 * their own if the stream never worked at all.
 *
 * `EventSource` is the reason this is SSE rather than a WebSocket: it reconnects by
 * itself, and the failure mode this design actually has to survive is forty phones
 * locking their screens.
 */

export type Health = 'connecting' | 'live' | 'polling' | 'revoked' | 'lost';

const HEALTHY_POLL_MS = 20_000;
const FALLBACK_POLL_MS = 3_000;
/** No event and no heartbeat for this long means the stream is not really up. */
const STREAM_STALE_MS = 25_000;

export type Meeting<V extends AnyView> = {
  view: V | null;
  health: Health;
  /** `serverTime - Date.now()`, so a wrong phone clock cannot skew a countdown. */
  skewMs: number;
  resync: () => void;
  send: <T>(path: string, body?: unknown) => Promise<Reply<T>>;
};

export function useMeeting<V extends AnyView>(
  viewPath: string,
  streamPath: string,
  enabled: boolean,
): Meeting<V> {
  const [view, setView] = useState<V | null>(null);
  const [health, setHealth] = useState<Health>('connecting');
  const [skewMs, setSkewMs] = useState(0);
  const lastBeat = useRef(0);

  const accept = useCallback((next: AnyView | undefined) => {
    if (next === undefined) return;
    setView(next as V);
    setSkewMs(next.serverTime - Date.now());
  }, []);

  const resync = useCallback(() => {
    if (!enabled) return;
    void get<{ view: AnyView }>(viewPath).then((reply) => {
      if (reply.ok) {
        accept(reply.data.view);
        return;
      }
      // A session the server will not honour is not a thing to wait out. Say so, so the
      // screen can offer a way back in rather than sitting on "catching up" forever —
      // which is exactly what a dropped cookie used to look like.
      if (reply.error === 'unknown_session' || reply.error === 'not_host') setHealth('lost');
    });
  }, [accept, enabled, viewPath]);

  /** Every mutation answers with the caller's new view, so the UI is never briefly stale. */
  const send = useCallback(
    async <T,>(path: string, body: unknown = {}): Promise<Reply<T>> => {
      const reply = await post<T & { view?: AnyView }>(path, body);
      if (reply.ok) accept(reply.data.view);
      return reply as Reply<T>;
    },
    [accept],
  );

  useEffect(() => {
    if (!enabled) return;
    resync();

    const source = new EventSource(`${API}${streamPath}`);
    lastBeat.current = Date.now();

    source.addEventListener('view', (event) => {
      lastBeat.current = Date.now();
      setHealth('live');
      try {
        accept(JSON.parse((event as MessageEvent<string>).data) as AnyView);
      } catch {
        resync();
      }
    });

    // The seat was taken over by another phone. Say so rather than leaving this one
    // staring at a frozen screen wondering why nothing moves.
    source.addEventListener('revoked', () => setHealth('revoked'));

    source.addEventListener('open', () => {
      lastBeat.current = Date.now();
      setHealth('live');
      resync();
    });

    source.addEventListener('error', () => {
      setHealth((current) => (current === 'revoked' || current === 'lost' ? current : 'polling'));
    });

    // One timer, ticking at the fallback rate, that only actually fetches when it needs
    // to: every three seconds while the stream looks dead, every twenty while it looks
    // alive. Polling at the fast rate regardless would triple the request count for
    // nothing — and with forty clients across a thirty-five minute meeting, that is the
    // difference between a rounding error and a real share of the daily budget.
    let sinceFetch = 0;
    const poll = window.setInterval(() => {
      const stale = Date.now() - lastBeat.current > STREAM_STALE_MS;
      setHealth((current) => {
        if (current === 'revoked' || current === 'lost') return current;
        return stale ? 'polling' : current;
      });
      sinceFetch += FALLBACK_POLL_MS;
      if (stale || sinceFetch >= HEALTHY_POLL_MS) {
        sinceFetch = 0;
        resync();
      }
    }, FALLBACK_POLL_MS);

    // iOS freezes a backgrounded page and tears the connection down without always
    // telling us. Coming back to the foreground, take the truth immediately rather than
    // waiting to find out whether the stream survived.
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      resync();
      if (source.readyState === EventSource.CLOSED) setHealth('polling');
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      source.close();
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [accept, enabled, resync, streamPath]);

  return { view, health, skewMs, resync, send };
}

/**
 * Keeps the screen awake while a round is running. A phone that sleeps mid-round is a
 * partner who stops answering.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async (): Promise<void> => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void next.release();
          return;
        }
        lock = next;
      } catch {
        // Denied, unsupported, or the page is not visible. Not worth telling anyone.
      }
    };

    void acquire();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
