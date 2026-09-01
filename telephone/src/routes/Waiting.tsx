import { AppShell, Button, MicroLabel, Rule } from '@cpatgt/shared';
import { useState } from 'react';
import { Banner } from '../components/Banner.tsx';
import { MessageLog } from '../components/MessageLog.tsx';
import { RoundBar } from '../components/RoundBar.tsx';
import { SnakeGrid } from '../components/SnakeGrid.tsx';
import { MAX_DIGITS, type RoundSpec, roundById, sampleFor } from '../protocol/rounds.ts';
import type { PlayerView, Role } from '../protocol/types.ts';
import type { Meeting } from '../state/useMeeting.ts';
import { forgetSession, post } from '../transport/client.ts';

/**
 * Everything that is not the round itself: waiting for the host, protocol time, and the
 * answer afterwards.
 *
 * Both roles share it because both need the same things at those moments — what the next
 * round looks like, and how the last one went.
 */
export function Waiting({
  view,
  meeting,
  role,
  msLeft,
}: {
  view: PlayerView;
  meeting: Meeting<never> | Meeting<PlayerView> | { health: Meeting<never>['health'] };
  role: Role;
  msLeft: number;
}) {
  const round = view.round;
  const phase = round?.phase ?? 'lobby';
  const spec = round === null ? null : roundById(round.id);
  const partnerSeated =
    role === 'sender' ? view.team.receiver === 'held' : view.team.sender === 'held';

  return (
    <AppShell
      mark={view.team.name}
      align="start"
      contentClassName="max-w-md"
      trailing={
        <RoundBar
          round={round}
          msLeft={msLeft}
          sent={view.sent.length}
          received={view.received.length}
          health={meeting.health}
        />
      }
    >
      <div className="flex flex-col gap-8">
        {!partnerSeated && (
          <div className="flex flex-col gap-2 border border-hairline-strong bg-ground-raised p-4">
            <MicroLabel as="h2" className="text-ink">
              Waiting for your partner
            </MicroLabel>
            <p className="font-mono text-5xl tnum tracking-[0.15em] text-ink">{view.team.code}</p>
            <p className="text-sm text-ink-muted">
              They tap <b>Join your partner</b> and type this in.
            </p>
          </div>
        )}

        {phase === 'lobby' && (
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
              You&apos;re in
            </h1>
            <p className="text-sm text-ink-muted">
              You are the one who {role === 'sender' ? 'sees the snake' : 'draws it'}.
            </p>
          </div>
        )}

        {phase === 'brief' && round !== null && (
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
              Agree on a protocol
            </h1>
            <MicroLabel as="h2">Round {round.index}</MicroLabel>
            {/*
              Both halves of a team see this, and both see the same one — it is drawn from
              a fixed seed rather than the meeting's, so it says nothing about the picture
              about to be sent. Without it the sender is describing a shape the receiver has
              never seen the like of, which is not a protocol, it is a guess.
            */}
            {spec !== null && (
              <div className="flex flex-col gap-2">
                <MicroLabel as="h2">An example, not this round&apos;s</MicroLabel>
                <SnakeGrid
                  size={spec.size}
                  grid={sampleFor(spec).grid}
                  levels={spec.levels}
                  rails
                  numbers
                  head={sampleFor(spec).path[0] ?? null}
                  className="mx-auto max-w-[16rem]"
                />
              </div>
            )}
            <Rule />
            <dl className="flex flex-col gap-2 text-sm">
              <Fact label="Grid" value={`${round.w} by ${round.h}`} />
              <Fact label="Snake" value={`${round.snakeLength} cells`} />
              {spec !== null && <Fact label="Shape" value={shapeOf(spec)} />}
            {round.shapeGiven && (
                <Fact label="You draw" value="Nothing — the colours only" />
              )}
              <Fact
                label="Colours"
                value={round.levels > 1 ? `${round.levels} levels` : 'Black and white'}
              />
              {round.lossy && <Fact label="Channel" value="One in five lost, never told which" />}
              {!round.counts && <Fact label="Scoring" value="Warm-up — off the record" />}
            </dl>
            <Rule />
            <p className="text-xs text-ink-faint">
              Messages are digits only, {MAX_DIGITS} at most, and every message counts.
            </p>
          </div>
        )}

        {phase === 'reveal' && round !== null && view.reveal !== null && (
          <div className="flex flex-col gap-4">
            <Banner
              tone="done"
              title={view.solved ? 'Solved' : 'Time up'}
              {...(view.solved ? {} : { detail: 'Not solved. The answer is below.' })}
            />
            <SnakeGrid
              size={{ w: round.w, h: round.h }}
              grid={view.reveal.target}
              levels={round.levels}
              rails
              numbers
              wrong={view.solved ? undefined : view.reveal.differences}
              className="mx-auto max-w-xs"
            />
            <p className="text-sm text-ink-muted">
              {view.messagesUsed} message{view.messagesUsed === 1 ? '' : 's'}
              {view.standing !== null && ` · ${view.standing.solved} solved so far`}
            </p>
            <Rule />
            <div className="flex flex-col gap-6">
              <MessageLog
                title="You sent"
                messages={view.sent}
                emptyLabel="Nothing."
                role={role}
              />
              <MessageLog
                title="You received"
                messages={view.received}
                emptyLabel="Nothing arrived."
                role={role}
              />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">That&apos;s it</h1>
            <p className="text-sm text-ink-muted">
              {view.standing === null
                ? 'Thanks for playing.'
                : `You finished ${ordinal(view.standing.rank)} with ${view.standing.solved} solved on ${view.standing.messages} messages.`}
            </p>
          </div>
        )}

        {(phase === 'lobby' || phase === 'brief') && <LeaveSeat role={role} />}
      </div>
    </AppShell>
  );
}

/**
 * A way out of the wrong seat.
 *
 * Only before the clock starts. A pair who picked the wrong way round work that out while
 * reading the brief, and a tap that silently drops your seat is a different thing entirely
 * once the round is running and your partner is waiting on you — so mid-round there is
 * deliberately no button at all.
 *
 * Two taps rather than one, because the phrasing is the reassurance: what you lose is the
 * seat, not the team, and the code still works.
 */
function LeaveSeat({ role }: { role: Role }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const leave = async (): Promise<void> => {
    setBusy(true);
    await post('/leave');
    // Whatever the server said, this phone is done with that seat. The session is already
    // gone server-side, so a stale copy here would only fail the next rejoin.
    forgetSession();
    window.location.reload();
  };

  if (!asking) {
    return (
      <div className="border-t border-hairline pt-6">
        <Button variant="ghost" onClick={() => setAsking(true)}>
          Wrong seat?
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-hairline pt-6">
      <p className="text-sm text-ink-muted">
        You are {role === 'sender' ? 'sending' : 'drawing'}. Leaving frees this seat and
        keeps the team — join again with the same code to take either one.
      </p>
      <div className="flex gap-2">
        <Button variant="quiet" disabled={busy} onClick={() => void leave()}>
          Leave the seat
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
          Stay
        </Button>
      </div>
    </div>
  );
}

/** What the round's prose used to say, as a fact the spec already knows. */
function shapeOf(spec: RoundSpec): string {
  if (spec.shapeGiven) return 'Drawn for you — colours only';
  if (spec.shape.kind === 'straight') return 'One straight line';
  if (spec.shape.kind === 'rectilinear') return `${spec.shape.segments} straight runs`;
  return 'Bends anywhere';
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
      <dt>
        <MicroLabel>{label}</MicroLabel>
      </dt>
      <dd className="font-mono text-sm tnum text-ink">{value}</dd>
    </div>
  );
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const ones = n % 10;
  return `${n}${ones === 1 ? 'st' : ones === 2 ? 'nd' : ones === 3 ? 'rd' : 'th'}`;
}
