import { useCallback, useSyncExternalStore } from 'react';
import { isRoomCode } from '../protocol/codes.ts';

/**
 * Hash routing, in about twenty lines and with no dependency — `cn` and `formatDuration`
 * set the precedent for that trade in this repo.
 *
 * It has to be the hash rather than the path. Every workspace here builds with
 * `base: './'`, so assets are referenced relatively; under path routing a visit to
 * `/host/` would resolve `./assets/index-abc.js` against `/host/` and the page would
 * fail to load its own JavaScript. Hash routes also cannot collide with `/api`, and they
 * survive being pasted into a QR code.
 */

export type Route =
  | { kind: 'join' }
  | { kind: 'play' }
  | { kind: 'host' }
  | { kind: 'briefing' };

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0] ?? '';
  if (path.startsWith('host')) return { kind: 'host' };
  if (path.startsWith('brief')) return { kind: 'briefing' };
  if (path.startsWith('play')) return { kind: 'play' };
  return { kind: 'join' };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): { route: Route; go: (to: Route['kind']) => void } {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    // Server render: nobody is on the host screen before hydration.
    () => '',
  );

  const go = useCallback((to: Route['kind']) => {
    window.location.hash = to === 'join' ? '/' : `/${to}`;
  }, []);

  return { route: parse(hash), go };
}

/**
 * The room code travels in the hash so a board can be reopened and a join link can carry
 * it — `#/host?r=482913` for the projector, `#/?r=482913` behind a QR code. It is not a
 * secret; it is on a wall in front of the room.
 */
/**
 * `#/host?new` starts a meeting even though this tab already remembers one.
 *
 * Without it the only way to a fresh code is a brand new tab, because the room is kept in
 * `sessionStorage` and deleting the code from the address bar just falls back to it —
 * which looks exactly like the code being impossible to change.
 */
export function wantsNewRoom(): boolean {
  if (typeof window === 'undefined') return false;
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).has('new');
}

export function roomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const query = window.location.hash.split('?')[1] ?? '';
  const code = new URLSearchParams(query).get('r');
  return code !== null && isRoomCode(code) ? code : null;
}
