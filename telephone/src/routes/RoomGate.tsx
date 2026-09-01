import { AppShell, Button, MicroLabel, Rule } from '@cpatgt/shared';
import { useState } from 'react';
import { CodeEntry } from '../components/CodeEntry.tsx';
import type { Lobby } from '../protocol/types.ts';
import { get } from '../transport/client.ts';

/**
 * Which meeting this phone is joining.
 *
 * The code is checked here rather than on the way to a seat, because a mistyped room is
 * the one mistake that fails silently in every other design: the object behind a name
 * exists the moment anyone asks for it, so a wrong digit would drop someone into an empty
 * meeting of their own where the host never appears and nothing is obviously broken.
 */
export function RoomGate({ onEntered }: { onEntered: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const reply = await get<{ view: Lobby }>(`/lobby`, `/api/r/${code}`);
    setBusy(false);
    if (!reply.ok) {
      setError(
        reply.error === 'no_room'
          ? 'No meeting with that code. Check the screen at the front.'
          : reply.message,
      );
      return;
    }
    onEntered(code);
  };

  return (
    <AppShell mark="Competitive Programming at GT" contentClassName="max-w-sm" align="start">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink">Telephone</h1>
          <p className="text-sm text-ink-muted">
            One of you sees the snake. The other has to draw it.
          </p>
        </div>

        <Rule />

        <div className="flex flex-col gap-4">
          <MicroLabel as="h2">Room code</MicroLabel>
          <p className="text-sm text-ink-muted">Six digits, on the screen at the front.</p>
          <CodeEntry
            length={6}
            value={code}
            onChange={setCode}
            commitLabel="Enter"
            onCommit={() => void check()}
            disabled={busy}
          />
          {error !== null && <p className="text-sm text-ink">{error}</p>}
        </div>
      </div>
    </AppShell>
  );
}

/** Shown when a phone comes back to a meeting that is no longer there. */
export function RoomGone({ onReset }: { onReset: () => void }) {
  return (
    <AppShell mark="Telephone" contentClassName="max-w-sm">
      <div className="flex flex-col gap-4">
        <MicroLabel as="h1" className="text-ink">
          That meeting has ended
        </MicroLabel>
        <p className="text-sm text-ink-muted">
          The room code this phone was using is no longer running. There is a new one on the
          screen at the front.
        </p>
        <Rule />
        <Button variant="primary" size="lg" onClick={onReset}>
          Enter a room code
        </Button>
      </div>
    </AppShell>
  );
}
