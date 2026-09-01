import { MicroLabel, cn } from '@cpatgt/shared';
import type { Role } from '../protocol/types.ts';

/**
 * The two things a team must not miss.
 *
 * Both used to be a line of muted text in a footer rail — a round could end, or be won,
 * while the pair were heads-down on a grid and neither noticed. So this is deliberately
 * the loudest thing on the screen for as long as it is there: full width, inverted, and
 * bigger than anything it sits above.
 *
 * `urgent` is the one that borrows the accent, and it is the only banner that means the
 * player still has something to do. A result is not a pending action, so `done` is inked
 * instead — which also keeps the accent meaning exactly one thing.
 */
/**
 * A round where the snake is already drawn is a different game, and one a pair can waste
 * the whole clock on if they do not notice — the sender describing a shape the receiver
 * cannot change, the receiver hunting for a way to draw. The brief says so; this says so
 * again while the clock is running, which is when it matters.
 */
export function FixedShapeNote({ role }: { role: Role }) {
  return (
    <div className="flex flex-col gap-1 border border-hairline-strong bg-ground-raised p-3">
      <MicroLabel as="h2" className="text-ink">
        The shape is already given
      </MicroLabel>
      <p className="text-sm text-ink-muted">
        {role === 'sender'
          ? 'Your partner can see the snake. Only its colours are missing, so send those.'
          : 'The snake is drawn and cannot be moved. You are setting its colours only.'}
      </p>
    </div>
  );
}

/** Whichever of the two states is live, in the one place both play screens show it. */
export function PlayBanner({ solved, msLeft }: { solved: boolean; msLeft: number }) {
  if (solved) {
    return <Banner tone="done" title="Solved" detail="Keep going if you like — this one is right." />;
  }
  if (msLeft > 0 && msLeft <= LAST_CALL_MS) {
    const seconds = Math.ceil(msLeft / 1000);
    return <Banner tone="urgent" title={`${seconds} second${seconds === 1 ? '' : 's'} left`} />;
  }
  return null;
}

/** Late enough that it is news, early enough to finish a message. */
const LAST_CALL_MS = 30_000;

export function Banner({
  tone,
  title,
  detail,
}: {
  tone: 'done' | 'urgent';
  title: string;
  detail?: string;
}) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className={cn(
        'flex flex-col gap-1 px-4 py-3',
        tone === 'done' ? 'bg-ink text-ground' : 'bg-accent text-accent-ink',
      )}
    >
      <p className="text-2xl font-semibold leading-none tracking-[-0.02em]">{title}</p>
      {detail !== undefined && <p className="text-sm opacity-80">{detail}</p>}
    </div>
  );
}
