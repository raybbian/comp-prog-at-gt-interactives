import { ActionBar, Button } from '@cpatgt/shared';

export type TestBarProps = {
  label: string;
  detail: string;
  /** Total samples across every kit. */
  loaded: number;
  canRun: boolean;
  canName: boolean;
  naming: boolean;
  onClear: () => void;
  onRun: () => void;
  onName: () => void;
};

export function TestBar({
  label,
  detail,
  loaded,
  canRun,
  canName,
  naming,
  onClear,
  onRun,
  onName,
}: TestBarProps) {
  return (
    <ActionBar label={label} detail={detail}>
      {!naming && (
        <Button variant="ghost" onClick={onClear} disabled={loaded === 0}>
          Clear
        </Button>
      )}
      {/*
        Fixed width: the run label gains a digit as samples go in, and a button that
        resizes under the cursor reads as a glitch.
      */}
      {naming ? (
        <Button
          variant={canName ? 'primary' : 'quiet'}
          size="lg"
          onClick={onName}
          disabled={!canName}
          className="w-44"
        >
          Name it
        </Button>
      ) : (
        <Button
          variant={canRun ? 'primary' : 'quiet'}
          size="lg"
          onClick={onRun}
          disabled={!canRun}
          className="w-44"
        >
          {loaded === 0 ? 'Run the kits' : `Run the kits (${loaded})`}
        </Button>
      )}
    </ActionBar>
  );
}
