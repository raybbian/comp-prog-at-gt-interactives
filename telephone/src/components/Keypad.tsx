import { cn } from '@cpatgt/shared';
import type { ReactNode } from 'react';

/**
 * The only keyboard in the game.
 *
 * `inputMode="numeric"` does not actually restrict what can be typed — and on iOS it
 * raises the system keyboard, which eats close to half the viewport and pushes the thing
 * you are typing into off the screen. Building the keypad means the alphabet is enforced
 * rather than requested, the layout never moves, and one component serves the join code,
 * the message composer and the reply box.
 *
 * Keys are `h-14` squares: comfortably past the forty-four pixel floor, and reachable
 * one-handed at the bottom of the screen.
 */

export type KeypadProps = {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** The right-hand action key. Its label changes; its position never does. */
  commitLabel: string;
  onCommit: () => void;
  commitDisabled?: boolean;
  disabled?: boolean;
};

function Key({
  onClick,
  disabled,
  accent,
  wide,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-14 items-center justify-center border font-mono text-lg tnum',
        'transition-[background-color,border-color,color] duration-[var(--duration-quick)] ease-quart',
        'disabled:pointer-events-none disabled:opacity-35',
        wide === true && 'col-span-1',
        accent === true
          ? 'border-accent bg-accent text-accent-ink'
          : 'border-hairline-strong bg-ground-raised text-ink active:bg-ground-sunken',
      )}
    >
      {children}
    </button>
  );
}

export function Keypad({
  onDigit,
  onBackspace,
  commitLabel,
  onCommit,
  commitDisabled = false,
  disabled = false,
}: KeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
        <Key key={digit} onClick={() => onDigit(digit)} disabled={disabled}>
          {digit}
        </Key>
      ))}
      <Key onClick={onBackspace} disabled={disabled}>
        <span className="text-base">&#9003;</span>
      </Key>
      <Key onClick={() => onDigit('0')} disabled={disabled}>
        0
      </Key>
      {/* The one ochre element on the screen: this phone's pending action. */}
      <Key onClick={onCommit} disabled={disabled || commitDisabled} accent>
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.12em]">
          {commitLabel}
        </span>
      </Key>
    </div>
  );
}
