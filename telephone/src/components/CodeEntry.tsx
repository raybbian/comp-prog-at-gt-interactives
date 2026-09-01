import { cn } from '@cpatgt/shared';
import { Keypad } from './Keypad.tsx';

/**
 * Typing a number in, with a box per digit.
 *
 * Two codes are typed over an evening and they are different lengths on purpose — six
 * digits for the room, four for a team — so the box count is the thing that tells a player
 * which one they are being asked for, before they have read a word of the label.
 */
export function CodeEntry({
  length,
  value,
  onChange,
  commitLabel,
  onCommit,
  disabled,
}: {
  length: number;
  value: string;
  onChange: (next: string) => void;
  commitLabel: string;
  onCommit: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex h-16 flex-1 items-center justify-center border font-mono text-3xl tnum text-ink',
              i === value.length
                ? 'border-accent bg-accent-soft'
                : 'border-hairline-strong bg-ground-raised',
            )}
          >
            {value[i] ?? ''}
          </div>
        ))}
      </div>
      <Keypad
        onDigit={(digit) => onChange((value + digit).slice(0, length))}
        onBackspace={() => onChange(value.slice(0, -1))}
        commitLabel={commitLabel}
        commitDisabled={value.length !== length || disabled === true}
        onCommit={onCommit}
        {...(disabled === undefined ? {} : { disabled })}
      />
    </div>
  );
}
