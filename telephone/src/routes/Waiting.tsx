import { AppShell, MicroLabel, Rule } from '@cpatgt/shared';
import { MessageLog } from '../components/MessageLog.tsx';
import { RoundBar } from '../components/RoundBar.tsx';
import { SnakeGrid } from '../components/SnakeGrid.tsx';
import { roundById, sampleFor } from '../protocol/rounds.ts';
import type { PlayerView, Role } from '../protocol/types.ts';
import type { Meeting } from '../state/useMeeting.ts';

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
              You are the one who {role === 'sender' ? 'sees the snake' : 'draws it'}. Wait for
              the round to start.
            </p>
          </div>
        )}

        {phase === 'brief' && round !== null && (
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
              Agree on a protocol
            </h1>
            <p className="text-sm text-ink-muted">
              Round {round.index}. {round.brief}
            </p>
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
                  head={sampleFor(spec).path[0] ?? null}
                  className="mx-auto max-w-[16rem]"
                />
                <p className="text-xs text-ink-faint">
                  You are both looking at this. Work out how you would send it.
                </p>
              </div>
            )}
            <Rule />
            <dl className="flex flex-col gap-2 text-sm">
              <Fact label="Grid" value={`${round.w} by ${round.h}`} />
              <Fact label="Snake" value={`${round.snakeLength} cells`} />
              <Fact
                label="Colours"
                value={round.levels > 1 ? `${round.levels} levels` : 'Black and white'}
              />
              {round.lossy && <Fact label="Channel" value="One in five will be lost" />}
              {!round.counts && <Fact label="Scoring" value="Warm-up — off the record" />}
            </dl>
            <Rule />
            <p className="text-xs text-ink-faint">
              Messages are digits only, eight at most, and every message counts.
            </p>
          </div>
        )}

        {phase === 'reveal' && round !== null && view.reveal !== null && (
          <div className="flex flex-col gap-4">
            <MicroLabel as="h1" className="text-ink">
              {view.solved ? 'Solved' : 'Not this time'}
            </MicroLabel>
            <SnakeGrid
              size={{ w: round.w, h: round.h }}
              grid={view.reveal.target}
              levels={round.levels}
              rails
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
      </div>
    </AppShell>
  );
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
