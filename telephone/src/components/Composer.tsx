import { MicroLabel, cn } from '@cpatgt/shared';
import { MAX_DIGITS } from '../protocol/rounds.ts';

/**
 * The message being typed, as a fixed track of eight slots.
 *
 * Fixed rather than growing, so the budget is a thing you can see rather than a number
 * you have to remember — the whole game is about what fits in eight digits.
 */
export function Composer({ digits, max = MAX_DIGITS }: { digits: string; max?: number }) {
  const left = max - digits.length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-px">
        {Array.from({ length: max }, (_, i) => {
          const digit = digits[i];
          const isCaret = i === digits.length;
          return (
            <div
              key={i}
              className={cn(
                'flex h-11 flex-1 items-center justify-center border font-mono text-xl tnum',
                digit === undefined ? 'text-ink-faint' : 'text-ink',
                isCaret ? 'border-accent bg-accent-soft' : 'border-hairline bg-ground-raised',
              )}
            >
              {digit ?? ''}
            </div>
          );
        })}
      </div>
      <MicroLabel className={cn(left === 0 && 'text-accent')}>
        {left === 0 ? 'Message full' : `${left} left`}
      </MicroLabel>
    </div>
  );
}
