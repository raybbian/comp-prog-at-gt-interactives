import { Button, MicroLabel } from '@cpatgt/shared';

export type KitControlsProps = {
  kitCount: number;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
};

/**
 * Sits directly under the grid rather than in the footer rail: adding a kit adds a
 * row, so the control belongs where the row will appear.
 */
export function KitControls({
  kitCount,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: KitControlsProps) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button variant="quiet" onClick={onAdd} disabled={!canAdd} className="-ml-px">
        Add a kit
      </Button>
      <Button variant="ghost" onClick={onRemove} disabled={!canRemove}>
        Remove
      </Button>
      <MicroLabel className="pl-2">
        {kitCount} kit{kitCount === 1 ? '' : 's'}
      </MicroLabel>
    </div>
  );
}
