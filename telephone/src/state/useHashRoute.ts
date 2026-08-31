import { useCallback, useSyncExternalStore } from 'react';

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
 * The host key arrives in the URL, is exchanged for a cookie, and is then wiped from the
 * address bar — which is on a projector in front of twenty people holding cameras.
 */
export function takeHostKey(): string | null {
  if (typeof window === 'undefined') return null;
  const query = window.location.hash.split('?')[1] ?? '';
  const key = new URLSearchParams(query).get('k');
  if (key === null) return null;
  window.history.replaceState(null, '', `${window.location.pathname}#/host`);
  return key;
}
