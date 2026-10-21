import { ActionBar, Button } from '@cpatgt/shared';

export type HitBarProps = {
  turnLabel: string;
  detail: string;
  staged: number | null;
  canCommit: boolean;
  onCommit: () => void;
};

/** Fills `AppShell`'s footer: whose turn and what just happened, then the commit button. */
export function HitBar({ turnLabel, detail, staged, canCommit, onCommit }: HitBarProps) {
  return (
    <ActionBar label={turnLabel} detail={detail}>
      {/* Fixed width: the label gains a number when a hit is staged, and a button that
          resizes under the thumb reads as a glitch. */}
      <Button
        variant={canCommit ? 'primary' : 'quiet'}
        size="lg"
        onClick={onCommit}
        disabled={!canCommit}
        className="w-32"
      >
        {staged === null ? 'Hit' : `Hit ${staged}`}
      </Button>
    </ActionBar>
  );
}
