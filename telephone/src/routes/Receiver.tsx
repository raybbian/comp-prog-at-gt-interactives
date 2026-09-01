import { ActionBar, AppShell, Button, MicroLabel, Rule, cn } from '@cpatgt/shared';
import { useEffect, useRef, useState } from 'react';
import { Composer } from '../components/Composer.tsx';
import { Keypad } from '../components/Keypad.tsx';
import { PlayBanner } from '../components/Banner.tsx';
import { MessageLog } from '../components/MessageLog.tsx';
import { PathStrip } from '../components/PathStrip.tsx';
import { RoundBar } from '../components/RoundBar.tsx';
import { SnakeGrid } from '../components/SnakeGrid.tsx';
import { groupDigits } from '../format.ts';
import { MAX_DIGITS } from '../protocol/rounds.ts';
import type { ReceiverView } from '../protocol/types.ts';
import { useCountdown } from '../state/useCountdown.ts';
import type { Meeting } from '../state/useMeeting.ts';
import { useSnakeEditor } from '../state/useSnakeEditor.ts';
import { newMessageId } from '../transport/client.ts';
import { Waiting } from './Waiting.tsx';

/**
 * The phone that has to draw it.
 *
 * A readable message log and a usable grid do not both fit on a phone, so they are tabs —
 * with the message you are currently working from pinned above both, because losing your
 * place in an eight-digit string is the single most common way a round goes wrong.
 */
export function Receiver({
  view,
  meeting,
}: {
  view: ReceiverView;
  meeting: Meeting<ReceiverView>;
}) {
  const round = view.round;
  const [tab, setTab] = useState<'draw' | 'inbox'>('draw');
  const [cursor, setCursor] = useState(0);
  const [replying, setReplying] = useState(false);
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const msLeft = useCountdown(round?.phaseEndsAt ?? null, meeting.skewMs);

  const editor = useSnakeEditor({
    size: { w: round?.w ?? 1, h: round?.h ?? 1 },
    roundId: round?.id ?? 'none',
    levels: round?.levels ?? 1,
    fixedPath: round?.shapeGiven === true ? (view.shapePath ?? []) : null,
    serverGrid: view.grid,
  });

  // The drawing is pushed up as it changes, so a phone that dies mid-round has already
  // left its picture on the server. Debounced: a drag is one save, not forty.
  const pending = useRef<string | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    if (round?.phase !== 'play') return;
    if (editor.grid === view.grid) return;
    pending.current = editor.grid;
    const id = window.setTimeout(() => {
      const grid = pending.current;
      if (grid === null || sending.current) return;
      sending.current = true;
      void meeting.send('/grid', { grid }).finally(() => {
        sending.current = false;
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, [editor.grid, meeting, round?.phase, view.grid]);

  if (round === null || round.phase !== 'play') {
    return <Waiting view={view} meeting={meeting} role="receiver" msLeft={msLeft} />;
  }

  const current = view.received[cursor];

  const submit = async (): Promise<void> => {
    const reply = await meeting.send<{ solved: boolean }>('/submit');
    setNote(
      !reply.ok
        ? reply.message
        : reply.data.solved
          ? 'That is the picture. Nicely done.'
          : 'Not yet — compare your log with your partner.',
    );
  };

  const reply = async (): Promise<void> => {
    if (digits.length === 0) return;
    const body = digits;
    setDigits('');
    const sent = await meeting.send('/messages', { body, clientMsgId: newMessageId() });
    if (!sent.ok) {
      setNote(sent.message);
      setDigits(body);
      return;
    }
    setReplying(false);
  };

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
      footer={
        <ActionBar
          label={`Round ${round.index}`}
          detail={note ?? `${view.messagesUsed} message${view.messagesUsed === 1 ? '' : 's'} sent`}
        >
          <Button variant="quiet" onClick={() => setReplying(true)}>
            Reply
          </Button>
          <Button variant="primary" onClick={() => void submit()}>
            Submit
          </Button>
        </ActionBar>
      }
    >
      <div className="flex flex-col gap-4">
        <PlayBanner solved={view.solved} msLeft={msLeft} />

        {/* Pinned above both tabs: the message you are working from, and where you are in it. */}
        <div className="flex flex-col gap-2 border border-hairline-strong bg-ground-raised p-3">
          <div className="flex items-center justify-between">
            <MicroLabel>
              {view.received.length === 0
                ? 'Nothing yet'
                : `Message ${cursor + 1} of ${view.received.length}`}
            </MicroLabel>
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => setCursor((c) => Math.max(0, c - 1))}>
                Prev
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCursor((c) => Math.min(view.received.length - 1, c + 1))}
              >
                Next
              </Button>
            </div>
          </div>
          <p className="font-mono text-2xl tnum tracking-[0.12em] text-ink">
            {current === undefined ? '········' : groupDigits(current.body)}
          </p>
        </div>

        <div className="flex gap-3">
          {(['draw', 'inbox'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                'border-b-2 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em]',
                tab === value ? 'border-ink text-ink' : 'border-transparent text-ink-faint',
              )}
            >
              {value === 'draw' ? 'Draw' : `Log (${view.received.length + view.sent.length})`}
            </button>
          ))}
        </div>

        {tab === 'draw' ? (
          <div className="flex flex-col gap-4">
            <SnakeGrid
              size={{ w: round.w, h: round.h }}
              grid={editor.grid}
              levels={round.levels}
              rails
              head={round.shapeGiven ? (view.shapePath?.[0] ?? null) : (editor.path[0] ?? null)}
              onCellDown={round.shapeGiven ? undefined : editor.beginAt}
              onCellEnter={round.shapeGiven ? undefined : editor.dragTo}
              onPointerUp={editor.endStroke}
              className="mx-auto max-h-[38dvh] max-w-full"
            />

            {!round.shapeGiven && (
              <>
                <p className="text-xs text-ink-faint">
                  Tap a cell to start, then swipe. It will only go where a snake can go — tap
                  the tip again to take it back.
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="quiet" onClick={editor.undo}>
                    Undo
                  </Button>
                  <Button variant="quiet" onClick={editor.redo}>
                    Redo
                  </Button>
                  <span className="ml-auto font-mono text-xs tnum text-ink-faint">
                    {editor.path.length}/{round.snakeLength}
                  </span>
                </div>
              </>
            )}

            {/* Any round with colours gets the ribbon, not just the one where the shape
                is handed over: on a coloured round you have drawn the snake and still have
                to say what colour each cell is, and hunting a thirty-pixel target in two
                dimensions is the wrong way to enter thirty levels on a phone.

                Stuck to the bottom of the viewport rather than left to scroll: it is the
                control you use once per cell for thirty cells, and a decode that makes you
                scroll back to it between every digit is a decode nobody finishes. Sticky
                rather than fixed, so it comes to rest above the Submit rail instead of
                covering it. */}
            {round.levels > 1 && editor.path.length > 0 && (
              <div className="sticky bottom-0 z-10 border-t border-hairline bg-ground pb-2 pt-3">
                <PathStrip
                  levels={editor.levels}
                  cursor={editor.cursor}
                  levelCount={round.levels}
                  onCursor={editor.setCursor}
                  onBump={editor.bumpAt}
                  onSet={editor.setLevelAt}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <MessageLog
              title="You received"
              messages={view.received}
              emptyLabel="Nothing has arrived."
              role="receiver"
            />
            <MessageLog
              title="You sent"
              messages={view.sent}
              emptyLabel="You have not replied."
              role="receiver"
            />
          </div>
        )}

        <Rule />
        {/* Clear lives here, far from Submit. Losing the drawing to a fat finger is the
            worst thing that can happen on this screen. */}
        {!round.shapeGiven && (
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Clear the whole drawing?')) editor.clear();
            }}
          >
            Clear drawing
          </Button>
        )}
      </div>

      {replying && (
        <div className="fixed inset-0 z-10 flex flex-col justify-end bg-ground/95">
          <div className="safe-bottom mx-auto flex w-full max-w-md flex-col gap-3 border-t border-hairline px-6 pt-4">
            <div className="flex items-center justify-between">
              <MicroLabel as="h2">Reply &#183; costs one message</MicroLabel>
              <Button variant="ghost" onClick={() => setReplying(false)}>
                Cancel
              </Button>
            </div>
            <Composer digits={digits} />
            <Keypad
              onDigit={(digit) => setDigits((c) => (c + digit).slice(0, MAX_DIGITS))}
              onBackspace={() => setDigits((c) => c.slice(0, -1))}
              commitLabel="Send"
              commitDisabled={digits.length === 0}
              onCommit={() => void reply()}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
