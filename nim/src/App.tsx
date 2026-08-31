import {
  AppShell,
  BoothAttract,
  BoothControls,
  GameOverPanel,
  HelpDialog,
  Rule,
  createLeaderboard,
  useBoothSession,
  useElapsed,
  usePointerKind,
  useReducedMotion,
} from '@cpatgt/shared';
import { useCallback, useEffect, useReducer } from 'react';
import { Board } from './components/Board';
import { MoveBar } from './components/MoveBar';
import { bestMove, describeMove } from './game/nim';
import { createDealer } from './game/positions';
import {
  initialState,
  reducer,
  selectionToMove,
  type GameState,
  type Selection,
} from './game/state';
import { HELP_TOPICS } from './help';

const BOT_PAUSE_MS = 520;
const BOT_PAUSE_REDUCED_MS = 150;
const STAGGER_MS = 45;

// One booth, one screen, one of each: no reason for these to live in component state.
const dealer = createDealer();
const board = createLeaderboard({ key: 'nim.v1', order: 'asc', limit: 100 });

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(dealer()));

  const pointerKind = usePointerKind();
  const reducedMotion = useReducedMotion();

  const isPlaying = state.phase === 'playing';
  const isOverGame = state.phase === 'won' || state.phase === 'lost';
  const elapsedMs = useElapsed(state.startedAt, state.finishedAt);

  const deal = useCallback(() => dispatch({ type: 'new', heaps: dealer() }), []);

  const session = useBoothSession({
    board,
    inProgress: state.startedAt !== null && !isOverGame,
    awaitingName: state.phase === 'won' && !state.hintUsed,
    onNewGame: deal,
  });

  // The bot answers after a beat. Without it the board changes in the same frame as
  // the visitor's click and reads as a glitch rather than a reply.
  useEffect(() => {
    if (state.phase !== 'botThinking') return;
    const timer = window.setTimeout(
      () => {
        const move = bestMove(state.heaps);
        if (move !== null) dispatch({ type: 'bot', move });
      },
      reducedMotion ? BOT_PAUSE_REDUCED_MS : BOT_PAUSE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [state.phase, state.heaps, reducedMotion]);

  const commit = useCallback((selection: Selection) => {
    dispatch({ type: 'commit', selection });
  }, []);

  const handleSelect = useCallback(
    (selection: Selection) => {
      // No hover on touch, so the first tap has to show the take before it happens;
      // the reducer decides whether this tap stages or commits.
      if (pointerKind === 'fine') commit(selection);
      else dispatch({ type: 'tap', selection });
    },
    [commit, pointerKind],
  );

  const handlePreview = useCallback(
    (selection: Selection) => {
      if (pointerKind === 'fine') dispatch({ type: 'select', selection });
    },
    [pointerKind],
  );

  const handleClearPreview = useCallback(() => {
    if (pointerKind === 'fine') dispatch({ type: 'select', selection: null });
  }, [pointerKind]);

  useEffect(() => {
    if (!isPlaying || session.attract || session.help) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return;

      const rows = state.heaps.flatMap((size, row) => (size > 0 ? [row] : []));
      if (rows.length === 0) return;

      const current = state.selection;
      const rowIndex = current === null ? -1 : rows.indexOf(current.row);
      const select = (row: number, from: number): void => {
        const size = state.heaps[row] ?? 0;
        dispatch({
          type: 'select',
          selection: { row, from: Math.min(Math.max(from, 0), size - 1) },
        });
      };

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown': {
          event.preventDefault();
          const step = event.key === 'ArrowDown' ? 1 : -1;
          const next =
            rowIndex === -1
              ? (rows[0] as number)
              : (rows[(rowIndex + step + rows.length) % rows.length] as number);
          select(next, (state.heaps[next] ?? 1) - 1);
          break;
        }
        // Left grows the take (start earlier in the row), right shrinks it.
        case 'ArrowLeft':
        case 'ArrowRight': {
          event.preventDefault();
          if (current === null) {
            const first = rows[0] as number;
            select(first, (state.heaps[first] ?? 1) - 1);
          } else {
            select(current.row, current.from + (event.key === 'ArrowRight' ? 1 : -1));
          }
          break;
        }
        case 'Enter':
          if (current !== null) {
            event.preventDefault();
            commit(current);
          }
          break;
        case 'Escape':
          dispatch({ type: 'select', selection: null });
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commit, isPlaying, session.attract, session.help, state.heaps, state.selection]);

  const takeCount =
    state.selection === null ? null : selectionToMove(state.heaps, state.selection).count;

  return (
    <>
      <AppShell
        mark="Competitive Programming at GT"
        contentClassName="max-w-xl"
        trailing={
          <BoothControls
            elapsedMs={elapsedMs}
            running={state.startedAt !== null}
            onHelp={session.openHelp}
            onBack={session.showAttract}
          />
        }
        footer={
          isOverGame ? undefined : (
            <MoveBar
              turnLabel={state.phase === 'botThinking' ? 'Bot' : 'Your turn'}
              detail={describeStatus(state)}
              takeCount={takeCount}
              canCommit={isPlaying && state.selection !== null}
              canHint={isPlaying && !state.hintUsed}
              hintUsed={state.hintUsed}
              onCommit={() => state.selection !== null && commit(state.selection)}
              onHint={() => dispatch({ type: 'hint' })}
            />
          )
        }
      >
        {isOverGame ? (
          <GameOverPanel
            headline={state.phase === 'won' ? 'You win' : 'Bot wins'}
            won={state.phase === 'won'}
            elapsedMs={elapsedMs}
            hintUsed={state.hintUsed}
            submitted={session.submitted}
            entries={session.entries}
            onSubmitName={(name) => session.submitName(name, elapsedMs)}
            onPlayAgain={session.newGame}
          />
        ) : (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink">Stone Game</h1>
              <p className="text-sm text-ink-muted">Take the last stone to win.</p>
            </div>
            <Rule />
            <Board
              opening={state.opening}
              heaps={state.heaps}
              selection={state.selection}
              hint={state.hint}
              lastRemoved={state.lastRemoved}
              interactive={isPlaying}
              staggerMs={reducedMotion ? 0 : STAGGER_MS}
              onPreview={handlePreview}
              onClearPreview={handleClearPreview}
              onSelect={handleSelect}
            />
          </div>
        )}
      </AppShell>

      {session.help && (
        <HelpDialog title="How to play" topics={HELP_TOPICS} onClose={session.closeHelp} />
      )}

      {session.attract && (
        <BoothAttract
          mark="Competitive Programming at GT"
          title="Stone Game"
          tagline="Take any number of stones from one row, whoever takes the last stone wins."
          entries={session.entries}
          emptyLabel="Nobody has beaten it yet."
          onDismiss={session.dismissAttract}
        />
      )}
    </>
  );
}

function describeStatus({ phase, lastMove, hint, hintRefused }: GameState): string {
  if (hintRefused) return 'No winning move left.';
  if (hint !== null) return `Hint: take ${describeMove(hint)}.`;
  if (phase === 'botThinking') return 'Thinking…';
  if (lastMove === null) return 'You go first.';
  const who = lastMove.by === 'you' ? 'You took' : 'Bot took';
  return `${who} ${describeMove(lastMove.move)}.`;
}
