import { AppShell, Button, MicroLabel, Rule } from '@cpatgt/shared';
import { useEffect, useState } from 'react';
import type { HostView, PlayerView } from './protocol/types.ts';
import { Briefing } from './routes/Briefing.tsx';
import { Host } from './routes/Host.tsx';
import { Join } from './routes/Join.tsx';
import { Receiver } from './routes/Receiver.tsx';
import { Sender } from './routes/Sender.tsx';
import { useMeeting, useWakeLock } from './state/useMeeting.ts';
import { takeHostKey, useRoute } from './state/useHashRoute.ts';
import { forgetSession, post, recallSession, rememberSession } from './transport/client.ts';

/**
 * Four screens behind three hash routes: the two phones share `#/`, the projector is at
 * `#/host`, and the briefing slide is at `#/brief`.
 *
 * Which of the two phone screens you get is decided by the server, not by the client —
 * the view it sends back is either a sender's or a receiver's, and a sender's view is the
 * only one with the picture in it.
 */
export function App() {
  const { route } = useRoute();
  if (route.kind === 'host') return <HostScreen />;
  if (route.kind === 'briefing') return <BriefingScreen />;
  return <PlayScreen />;
}

function BriefingScreen() {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return <Briefing joinUrl={origin} />;
}

function HostScreen() {
  const [claimed, setClaimed] = useState<boolean | null>(null);
  const [key, setKey] = useState('');

  // The key arrives in the URL, is swapped for a cookie, and is wiped from the address
  // bar — which is on a projector in front of the whole room.
  useEffect(() => {
    const fromUrl = takeHostKey();
    void (async () => {
      if (fromUrl !== null) {
        const reply = await post('/host/claim', { hostKey: fromUrl });
        // Stored in the same slot a player's session uses, so the header fallback carries
        // it too — the projector laptop is as likely to refuse a cookie as a phone is.
        if (reply.ok) rememberSession(fromUrl);
        setClaimed(reply.ok);
        return;
      }
      const existing = await post('/host/view');
      setClaimed(existing.ok);
    })();
  }, []);

  const meeting = useMeeting<HostView>('/host/view', '/host/events', claimed === true);

  if (claimed === false) {
    return (
      <AppShell mark="Competitive Programming at GT" contentClassName="max-w-sm">
        <div className="flex flex-col gap-4">
          <MicroLabel as="h1">Host key</MicroLabel>
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            className="h-14 w-full border border-hairline-strong bg-ground-raised px-4 font-mono text-lg text-ink focus-visible:border-accent focus-visible:outline-none"
          />
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              void post('/host/claim', { hostKey: key }).then((reply) => {
                if (reply.ok) rememberSession(key);
                setClaimed(reply.ok);
              });
            }}
          >
            Open the board
          </Button>
          <p className="text-sm text-ink-muted">
            The key is printed by <code>wrangler deploy</code>, or set as{' '}
            <code>HOST_KEY</code>.
          </p>
        </div>
      </AppShell>
    );
  }

  if (meeting.view === null) return <Splash line="Opening the board…" />;
  return <Host view={meeting.view} meeting={meeting} />;
}

function PlayScreen() {
  const [session, setSession] = useState<string | null | undefined>(undefined);

  // A phone that reloads, or comes back after being locked, gets its seat back without
  // anyone having to type a code again.
  useEffect(() => {
    const stored = recallSession();
    void (async () => {
      const reply = await post<{ sessionId: string }>('/rejoin', { sessionId: stored ?? '' });
      if (reply.ok) {
        rememberSession(reply.data.sessionId);
        setSession(reply.data.sessionId);
      } else {
        forgetSession();
        setSession(null);
      }
    })();
  }, []);

  const meeting = useMeeting<PlayerView>('/view', '/events', session !== null && session !== undefined);
  useWakeLock(meeting.view?.round?.phase === 'play');

  if (session === undefined) return <Splash line="Finding your team…" />;
  if (session === null) return <Join onJoined={() => window.location.reload()} />;

  if (meeting.health === 'revoked' || meeting.health === 'lost') {
    const revoked = meeting.health === 'revoked';
    return (
      <AppShell mark="Telephone" contentClassName="max-w-sm">
        <div className="flex flex-col gap-4">
          <MicroLabel as="h1" className="text-ink">
            {revoked ? 'Your teammate took this seat' : 'Lost your seat'}
          </MicroLabel>
          <p className="text-sm text-ink-muted">
            {revoked
              ? 'Another phone joined as the same half of your team. Join again to take it back, or take the other seat.'
              : 'This phone is no longer signed in to a team. Your join code still works — type it in again and take your seat back.'}
          </p>
          <Rule />
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              forgetSession();
              window.location.reload();
            }}
          >
            Join again
          </Button>
        </div>
      </AppShell>
    );
  }

  const view = meeting.view;
  if (view === null) return <Splash line="Catching up…" />;
  return view.kind === 'sender' ? (
    <Sender view={view} meeting={meeting as never} />
  ) : (
    <Receiver view={view} meeting={meeting as never} />
  );
}

function Splash({ line }: { line: string }) {
  return (
    <AppShell mark="Competitive Programming at GT" contentClassName="max-w-sm">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink">Telephone</h1>
        <MicroLabel className="animate-[pulse-label_3s_ease-in-out_infinite]">{line}</MicroLabel>
      </div>
    </AppShell>
  );
}
