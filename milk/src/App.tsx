import {
  AppShell,
  BoothAttract,
  BoothControls,
  DiscordCorner,
  GameOverPanel,
  HelpDialog,
  Rule,
  createLeaderboard,
  useBoothSession,
  useElapsed,
  useReducedMotion,
} from '@cpatgt/shared';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { KitControls } from './components/KitControls';
import { LoadingGrid } from './components/LoadingGrid';
import { TestBar } from './components/TestBar';
import {
  BUCKET_COUNT,
  bucketLabel,
  isIn,
  pickCulprit,
  readKits,
  samplesLoaded,
} from './game/buckets';
import { encodeScore, formatScore } from './game/score';
import {
  canAddKit,
  canName,
  canRemoveKit,
  canRun,
  initialState,
  isLocked,
  reducer,
  type GameState,
} from './game/state';
import { HELP_TOPICS } from './help';

const RUN_PAUSE_MS = 700;
const REVEAL_STEP_MS = 420;
const REDUCED_MS = 100;

const board = createLeaderboard({ key: 'milk.v1', order: 'asc', limit: 100 });

type Cursor = { bucket: number; kit: number };

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  // Null until an arrow key is pressed: a ring parked on the first cell from the
  // start would read as a selection nobody made.
  const [cursor, setCursor] = useState<Cursor | null>(null);

  const reducedMotion = useReducedMotion();

  const isOverGame = state.phase === 'won' || state.phase === 'lost';
  const naming = state.phase === 'naming';
  const elapsedMs = useElapsed(state.startedAt, state.finishedAt);

  const deal = useCallback(() => {
    dispatch({ type: 'new' });
    setCursor(null);
  }, []);

  const session = useBoothSession({
    board,
    inProgress: state.startedAt !== null && !isOverGame,
    awaitingName: state.phase === 'won',
    onNewGame: deal,
  });

  // Results land one kit at a time. All five at once is a single flash that nobody
  // reads; spaced out, the visitor watches the answer being written down.
  useEffect(() => {
    if (state.phase !== 'running') return;
    const delay = reducedMotion
      ? REDUCED_MS
      : state.revealed === 0
        ? RUN_PAUSE_MS
        : REVEAL_STEP_MS;
    const timer = window.setTimeout(() => dispatch({ type: 'revealNext' }), delay);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.revealed, reducedMotion]);

  const handleLoad = useCallback((bucket: number, kit: number, on: boolean) => {
    dispatch({ type: 'load', bucket, kit, on });
  }, []);

  const handleRun = useCallback(() => {
    const { pattern, candidates } = readKits(state.loading);
    dispatch({ type: 'run', pattern, candidates });
  }, [state.loading]);

  const handleName = useCallback(() => {
    const bucket = state.selection;
    if (bucket === null) return;
    dispatch({ type: 'name', bucket, culprit: pickCulprit(state.candidates, bucket) });
  }, [state.candidates, state.selection]);

  useEffect(() => {
    if (isOverGame || session.attract || session.help) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return;

      const move = (dBucket: number, dKit: number): void => {
        event.preventDefault();
        setCursor((current) => {
          if (current === null) return { bucket: 0, kit: 0 };
          return {
            bucket: (current.bucket + dBucket + BUCKET_COUNT) % BUCKET_COUNT,
            kit: (current.kit + dKit + state.kitCount) % state.kitCount,
          };
        });
      };

      switch (event.key) {
        case 'ArrowLeft':
          move(-1, 0);
          break;
        case 'ArrowRight':
          move(1, 0);
          break;
        case 'ArrowUp':
          move(0, -1);
          break;
        case 'ArrowDown':
          move(0, 1);
          break;
        case ' ':
          if (cursor === null) break;
          event.preventDefault();
          if (naming) dispatch({ type: 'select', bucket: cursor.bucket });
          else {
            dispatch({
              type: 'load',
              bucket: cursor.bucket,
              kit: cursor.kit,
              on: !isIn(state.loading, cursor.bucket, cursor.kit),
            });
          }
          break;
        case 'Enter':
          // Enter on a focused footer button is that button's job, not ours.
          if (event.target instanceof HTMLButtonElement) return;
          event.preventDefault();
          if (naming) handleName();
          else handleRun();
          break;
        case 'Escape':
          dispatch({ type: 'clear' });
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    cursor,
    handleName,
    handleRun,
    isOverGame,
    naming,
    session.attract,
    session.help,
    state.kitCount,
    state.loading,
  ]);

  const loaded = samplesLoaded(state.loading, state.kitCount);

  return (
    <>
      <AppShell
        mark="Competitive Programming at GT"
        contentClassName="max-w-3xl"
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
            <TestBar
              label={describeStep(state)}
              detail={describeStatus(state)}
              loaded={loaded}
              canRun={canRun(state)}
              canName={canName(state)}
              naming={naming}
              onClear={() => dispatch({ type: 'clear' })}
              onRun={handleRun}
              onName={handleName}
            />
          )
        }
      >
        {isOverGame ? (
          <GameOverPanel
            headline={state.phase === 'won' ? 'You win' : 'Wrong bucket'}
            won={state.phase === 'won'}
            elapsedMs={elapsedMs}
            note={
              state.culprit === null
                ? undefined
                : `It was bucket ${bucketLabel(state.culprit)}.`
            }
            submitted={session.submitted}
            entries={session.entries}
            boardHeading="Fewest kits"
            valueLabel="Kits · Time"
            format={formatScore}
            onSubmitName={(name) =>
              session.submitName(name, encodeScore(state.kitCount, elapsedMs))
            }
            onPlayAgain={session.newGame}
          />
        ) : (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink">Milk Test</h1>
              <p className="text-sm text-ink-muted">
                One of Farmer John's buckets is contaminated. Can you find out which one?
              </p>
            </div>

            <Rule />

            <LoadingGrid
              loading={state.loading}
              kitCount={state.kitCount}
              pattern={state.pattern}
              revealed={state.revealed}
              locked={isLocked(state)}
              selection={state.selection}
              cursor={cursor}
              onLoad={handleLoad}
              onSelect={(bucket) => dispatch({ type: 'select', bucket })}
            />

            {!isLocked(state) && (
              <KitControls
                kitCount={state.kitCount}
                canAdd={canAddKit(state)}
                canRemove={canRemoveKit(state)}
                onAdd={() => dispatch({ type: 'addKit' })}
                onRemove={() => dispatch({ type: 'removeKit' })}
              />
            )}
          </div>
        )}
      </AppShell>

      <DiscordCorner />

      {session.help && (
        <HelpDialog title="How to play" topics={HELP_TOPICS} onClose={session.closeHelp} />
      )}

      {session.attract && (
        <BoothAttract
          mark="Competitive Programming at GT"
          title="Milk Test"
          tagline="One of Farmer John's twenty buckets of milk is contaminated. Find it with as few test kits as you can."
          entries={session.entries}
          emptyLabel="Nobody has helped him yet."
          boardHeading="Fewest kits"
          valueLabel="Kits · Time"
          format={formatScore}
          onDismiss={session.dismissAttract}
        />
      )}
    </>
  );
}

function describeStep(state: GameState): string {
  switch (state.phase) {
    case 'running':
      return 'Running';
    case 'naming':
      return 'Results';
    default:
      return 'Load the kits';
  }
}

function describeStatus(state: GameState): string {
  if (state.phase === 'running') return 'Running the kits…';
  // Never says how many buckets fit: reading that off the grid is the game.
  if (state.phase === 'naming') return 'Results are in.';

  const loaded = samplesLoaded(state.loading, state.kitCount);
  return loaded === 0
    ? 'Nothing loaded yet.'
    : `${loaded} sample${loaded === 1 ? '' : 's'} loaded.`;
}
