import { AppShell, Button, MicroLabel, Rule } from '@cpatgt/shared';
import { useEffect, useState } from 'react';
import type { HostView, PlayerView } from './protocol/types.ts';
import { Briefing } from './routes/Briefing.tsx';
import { Host } from './routes/Host.tsx';
import { Join } from './routes/Join.tsx';
import { Receiver } from './routes/Receiver.tsx';
import { Sender } from './routes/Sender.tsx';
import { RoomGate, RoomGone } from './routes/RoomGate.tsx';
import { useMeeting, useWakeLock } from './state/useMeeting.ts';
import { roomFromUrl, useRoute } from './state/useHashRoute.ts';
import {
  enterRoom,
  forgetRoom,
  forgetSession,
  openRoom,
  post,
  recallRoom,
  rememberRoom,
  rememberSession,
  recallSession,
} from './transport/client.ts';

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

/**
 * Opening the board opens a meeting.
 *
 * The code is remembered per tab rather than per browser, so a reload — or the projector
 * being unplugged and the laptop lid closed — comes back to the same meeting, while a
 * second tab deliberately starts a second one. Nothing tries to stop that or to guess
 * which tab is the real one: the room can only join the code it can see.
 */
function HostScreen() {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const existing = roomFromUrl() ?? recallRoom('tab');
      const code = existing ?? (await openRoom().then((r) => (r.ok ? r.data.room : null)));
      if (code === null) {
        setReady(false);
        return;
      }
      enterRoom(code);
      rememberRoom(code, 'tab');
      // Back into the address bar, so the tab is recoverable if it is closed by accident.
      window.history.replaceState(null, '', `${window.location.pathname}#/host?r=${code}`);
      setReady(true);
    })();
  }, []);

  const meeting = useMeeting<HostView>('/host/view', '/host/events', ready === true);

  if (ready === false) return <Splash line="Could not open a meeting." />;
  if (meeting.view === null) return <Splash line="Opening the board…" />;
  return <Host view={meeting.view} meeting={meeting} />;
}

function PlayScreen() {
  const [room, setRoom] = useState<string | null | undefined>(undefined);
  const [session, setSession] = useState<string | null | undefined>(undefined);
  const [gone, setGone] = useState(false);

  // Unlike the board, a phone remembers its room for the whole device: it has to survive
  // being locked, closed, and picked up again twenty minutes later.
  useEffect(() => {
    const code = roomFromUrl() ?? recallRoom('device');
    if (code !== null) {
      enterRoom(code);
      // Including one that arrived on a link: a phone that scanned a QR must not be asked
      // for a code it was never made to type.
      rememberRoom(code, 'device');
    }
    setRoom(code);
  }, []);

  // A phone that reloads, or comes back after being locked, gets its seat back without
  // anyone having to type a code again.
  useEffect(() => {
    if (room === undefined || room === null) return;
    const stored = recallSession();
    void (async () => {
      const reply = await post<{ sessionId: string }>('/rejoin', { sessionId: stored ?? '' });
      if (reply.ok) {
        rememberSession(reply.data.sessionId);
        setSession(reply.data.sessionId);
        return;
      }
      // The meeting itself is gone, which is a different problem from having lost a seat
      // in one that is still running, and needs a different way out.
      if (reply.error === 'no_room') setGone(true);
      forgetSession();
      setSession(null);
    })();
  }, [room]);

  const leaveRoom = (): void => {
    forgetRoom('device');
    forgetSession();
    window.location.replace(`${window.location.pathname}#/`);
    window.location.reload();
  };

  const meeting = useMeeting<PlayerView>('/view', '/events', session !== null && session !== undefined);
  useWakeLock(meeting.view?.round?.phase === 'play');

  if (room === undefined) return <Splash line="Finding the meeting…" />;
  if (gone) return <RoomGone onReset={leaveRoom} />;
  if (room === null) {
    return (
      <RoomGate
        onEntered={(code) => {
          enterRoom(code);
          rememberRoom(code, 'device');
          setRoom(code);
        }}
      />
    );
  }
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
