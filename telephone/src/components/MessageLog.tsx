import { MicroLabel, Rule, cn } from '@cpatgt/shared';
import type { PublicMessage, Role } from '../protocol/types.ts';
import { groupDigits } from '../format.ts';

/**
 * Both logs, on both phones: everything this half sent, and everything that reached them.
 *
 * This is what stands in for partial credit. A submission is right or it is not, which
 * would be a harsh way to end a round if a team had no way of telling *where* it went
 * wrong — so both halves can read their own record and compare notes afterwards. "I sent
 * 4 7 1" against "I got 4 7 4" is a debuggable conversation; a percentage is not. On the
 * lossy round, holding the two lists side by side is the entire exercise.
 */

export function MessageLog({
  title,
  messages,
  emptyLabel,
  role,
  className,
}: {
  title: string;
  messages: readonly PublicMessage[];
  emptyLabel: string;
  role: Role;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between">
        <MicroLabel as="h2">{title}</MicroLabel>
        <span className="font-mono text-xs tnum text-ink-faint">{messages.length}</span>
      </div>
      <Rule />
      {messages.length === 0 ? (
        <p className="py-4 text-sm text-ink-faint">{emptyLabel}</p>
      ) : (
        <ol className="flex flex-col">
          {messages.map((message, i) => (
            <li
              key={message.seq}
              className="flex items-baseline gap-3 border-b border-hairline py-2 last:border-b-0"
            >
              <span className="w-6 shrink-0 font-mono text-xs tnum text-ink-faint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={cn(
                  'font-mono text-base tnum tracking-[0.08em]',
                  message.from === role ? 'text-ink-muted' : 'text-ink',
                )}
              >
                {groupDigits(message.body)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
