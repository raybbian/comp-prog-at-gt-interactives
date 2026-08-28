import { ActionBar, Button } from '@cpatgt/shared';

export type MoveBarProps = {
  turnLabel: string;
  detail: string;
  takeCount: number | null;
  canCommit: boolean;
  canHint: boolean;
  hintUsed: boolean;
  onCommit: () => void;
  onHint: () => void;
};

export function MoveBar({
  turnLabel,
  detail,
  takeCount,
  canCommit,
  canHint,
  hintUsed,
  onCommit,
  onHint,
}: MoveBarProps) {
  return (
    <ActionBar label={turnLabel} detail={detail}>
      <Button variant="ghost" onClick={onHint} disabled={!canHint}>
        {hintUsed ? 'Hint used' : 'Hint'}
      </Button>
      {/*
        Fixed width: the label gains a digit the moment a take is staged, and a
        button that resizes under the cursor on every hover reads as a glitch.
      */}
      <Button
        variant={canCommit ? 'primary' : 'quiet'}
        size="lg"
        onClick={onCommit}
        disabled={!canCommit}
        className="w-36"
      >
        {takeCount === null ? 'Take' : `Take ${takeCount}`}
      </Button>
    </ActionBar>
  );
}
