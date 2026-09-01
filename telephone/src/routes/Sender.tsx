import { AppShell, MicroLabel, Rule } from '@cpatgt/shared';
import { useState } from 'react';
import { Composer } from '../components/Composer.tsx';
import { Keypad } from '../components/Keypad.tsx';
import { PlayBanner } from '../components/Banner.tsx';
import { MessageLog } from '../components/MessageLog.tsx';
import { RoundBar } from '../components/RoundBar.tsx';
import { SnakeGrid } from '../components/SnakeGrid.tsx';
import { MAX_DIGITS } from '../protocol/rounds.ts';
import type { SenderView } from '../protocol/types.ts';
import type { Meeting } from '../state/useMeeting.ts';
import { useCountdown } from '../state/useCountdown.ts';
import { newMessageId } from '../transport/client.ts';
import { Waiting } from './Waiting.tsx';

/**
 * The phone that can see the picture.
 *
 * The grid scrolls and the keypad is pinned to the bottom, which is the only arrangement
 * that fits a picture, a log and a keyboard on a 390-point screen without any of them
 * being useless. Exactly one thing on this screen is ochre — the SEND key — because the
 * accent means this phone's own pending action and nothing else.
 */
export function Sender({
  view,
  meeting,
}: {
  view: SenderView;
  meeting: Meeting<SenderView>;
}) {
  const [digits, setDigits] = useState('');
  const [tab, setTab] = useState<'picture' | 'log'>('picture');
  const [error, setError] = useState<string | null>(null);
  const msLeft = useCountdown(view.round?.phaseEndsAt ?? null, meeting.skewMs);

  const round = view.round;
  const playing = round?.phase === 'play';

  const send = async (): Promise<void> => {
    if (digits.length === 0) return;
    const body = digits;
    setDigits('');
    setError(null);
    const reply = await meeting.send('/messages', { body, clientMsgId: newMessageId() });
    if (!reply.ok) {
      setError(reply.message);
      setDigits(body);
    }
  };

  if (round === null || !playing) {
    return <Waiting view={view} meeting={meeting} role="sender" msLeft={msLeft} />;
  }

  return (
    <AppShell
      mark={view.team.name}
      align="start"
      contentClassName="max-w-md"
      trailing={
        <RoundBar
          round={round}
          msLeft={msLeft}
          sent={view.sent.length}
          received={view.received.length}
          health={meeting.health}
        />
      }
    >
      <div className="flex flex-col gap-4 pb-64">
        <PlayBanner solved={view.solved} msLeft={msLeft} />

        <div className="flex items-baseline justify-between">
          <MicroLabel as="h1">Send this</MicroLabel>
          <span className="font-mono text-xs tnum text-ink-faint">
            {round.snakeLength} cells
          </span>
        </div>

        <div className="flex gap-2">
          {(['picture', 'log'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? 'border-b-2 border-ink pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink'
                  : 'border-b-2 border-transparent pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-faint'
              }
            >
              {value === 'picture' ? 'Picture' : `Log (${view.sent.length + view.received.length})`}
            </button>
          ))}
        </div>

        {tab === 'picture' ? (
          <SnakeGrid
            size={{ w: round.w, h: round.h }}
            grid={view.target}
            levels={round.levels}
            rails
            numbers
            head={view.shapePath?.[0] ?? null}
            className="mx-auto max-h-[42dvh] max-w-full"
          />
        ) : (
          <div className="flex flex-col gap-6">
            <MessageLog
              title="You sent"
              messages={view.sent}
              emptyLabel="Nothing yet."
              role="sender"
            />
            <MessageLog
              title="Your partner sent"
              messages={view.received}
              emptyLabel="Nothing back yet."
              role="sender"
            />
          </div>
        )}

        <Rule />
        <p className="text-xs text-ink-faint">
          Rows count down from the top, columns across from the left. A cell is row then
          column.
        </p>
      </div>

      {/* Pinned: the picture scrolls, the keyboard never moves. */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 border-t border-hairline bg-ground px-6 pt-3">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {error !== null && <p className="text-xs text-ink">{error}</p>}
          <Composer digits={digits} />
          <Keypad
            onDigit={(digit) => setDigits((current) => (current + digit).slice(0, MAX_DIGITS))}
            onBackspace={() => setDigits((current) => current.slice(0, -1))}
            commitLabel="Send"
            commitDisabled={digits.length === 0}
            onCommit={() => void send()}
          />
        </div>
      </div>
    </AppShell>
  );
}
