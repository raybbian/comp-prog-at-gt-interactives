import {
  AppShell,
  Button,
  HelpDialog,
  MicroLabel,
  Rule,
  useElapsed,
  usePointerKind,
  useReducedMotion,
} from '@cpatgt/shared';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { HealthBar } from './components/HealthBar';
import { HitBar } from './components/HitBar';
import { HitPad } from './components/HitPad';
import { LevelPick } from './components/LevelPick';
import { Verdict } from './components/Verdict';
import { bestHit } from './game/boss';
import { createDealer, LEVEL_LABELS, type Level, type Opening } from './game/levels';
import { initialState, reducer, type GameState } from './game/state';
import { HELP_TOPICS } from './help';

const BOT_PAUSE_MS = 520;
const BOT_PAUSE_REDUCED_MS = 150;

// One phone, one of each: no reason for the dealers to live in component state.
const dealers: Record<Level, () => Opening> = {
  easy: createDealer('easy'),
  medium: createDealer('medium'),
  hard: createDealer('hard'),
};

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [help, setHelp] = useState(false);

  const pointerKind = usePointerKind();
  const reducedMotion = useReducedMotion();

  const game = state.screen === 'game' ? state : null;
  const elapsedMs = useElapsed(game?.startedAt ?? null, game?.finishedAt ?? null);

  const pick = useCallback((level: Level) => {
    dispatch({ type: 'pick', level, opening: dealers[level]() });
  }, []);

  // The bot answers after a beat. Without it the health changes in the same frame as
  // the visitor's tap and reads as a glitch rather than a reply.
  useEffect(() => {
    if (game === null || game.phase !== 'botThinking') return;
    const { table, health, forbidden } = game;
    const timer = window.setTimeout(
      () => {
        const hit = bestHit(table, { health, forbidden });
        if (hit !== null) dispatch({ type: 'bot', hit });
      },
      reducedMotion ? BOT_PAUSE_REDUCED_MS : BOT_PAUSE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [game, reducedMotion]);

  const handleTap = useCallback(
    (hit: number) => {
      // A mouse previews on hover and commits on one click; touch has no hover, so the
      // first tap stages the hit and the second confirms it.
      if (pointerKind === 'fine') dispatch({ type: 'commit', hit });
      else dispatch({ type: 'tap', hit });
    },
    [pointerKind],
  );

  const handlePreview = useCallback(
    (hit: number | null) => {
      if (pointerKind === 'fine') dispatch({ type: 'stage', hit });
    },
    [pointerKind],
  );

  const trailing = (
    <>
      {game !== null && <MicroLabel>{LEVEL_LABELS[game.level]}</MicroLabel>}
      <Button variant="ghost" className="-mr-4" onClick={() => setHelp(true)}>
        Help
      </Button>
    </>
  );

  if (game === null) {
    return (
      <>
        <AppShell mark="Competitive Programming at GT" align="start" contentClassName="max-w-md" trailing={trailing}>
          <LevelPick onPick={pick} />
        </AppShell>
        {help && <HelpDialog title="How to play" topics={HELP_TOPICS} onClose={() => setHelp(false)} />}
      </>
    );
  }

  const isPlaying = game.phase === 'playing';
  const isOver = game.phase === 'won' || game.phase === 'lost';
  const lastHit = game.history[game.history.length - 1] ?? null;

  return (
    <>
      <AppShell
        mark="Competitive Programming at GT"
        align="start"
        contentClassName="max-w-md"
        trailing={trailing}
        footer={
          isOver ? undefined : (
            <HitBar
              turnLabel={turnLabel(game)}
              detail={describeStatus(game)}
              staged={game.staged}
              canCommit={isPlaying && game.staged !== null}
              onCommit={() => game.staged !== null && dispatch({ type: 'commit', hit: game.staged })}
            />
          )
        }
      >
        {isOver ? (
          <Verdict
            won={game.phase === 'won'}
            history={game.history}
            elapsedMs={elapsedMs}
            onPlayAgain={() => pick(game.level)}
            onChangeLevel={() => dispatch({ type: 'changeLevel' })}
          />
        ) : (
          <div className="flex flex-col gap-8 pb-4">
            <HealthBar opening={game.opening.health} health={game.health} lastHit={lastHit} />
            <Rule />
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <MicroLabel>Damage</MicroLabel>
                <MicroLabel>1 to {game.opening.m}</MicroLabel>
              </div>
              <HitPad
                m={game.opening.m}
                forbidden={game.forbidden}
                staged={game.staged}
                disabled={!isPlaying}
                onTap={handleTap}
                onPreview={handlePreview}
              />
            </div>
          </div>
        )}
      </AppShell>

      {help && <HelpDialog title="How to play" topics={HELP_TOPICS} onClose={() => setHelp(false)} />}
    </>
  );
}

function turnLabel({ phase }: GameState): string {
  if (phase === 'botThinking' || phase === 'lost') return 'Bot';
  if (phase === 'won') return 'You';
  return 'Your turn';
}

function describeStatus({ phase, history, forbidden, opening }: GameState): string {
  if (phase === 'botThinking') return 'Thinking…';
  const last = history[history.length - 1];
  if (last === undefined) return `You hit first. Any amount from 1 to ${opening.m}.`;
  if (last.by === 'bot') return `Bot hit ${last.hit}. You cannot hit ${forbidden}.`;
  return `You hit ${last.hit}.`;
}
