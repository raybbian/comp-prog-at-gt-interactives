import { cn } from '@cpatgt/shared';

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
