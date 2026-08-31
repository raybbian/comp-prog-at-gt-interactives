import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdle } from '../hooks/useIdle';
import type {
  Leaderboard as LeaderboardStore,
  LeaderboardEntry,
  SubmittedRun,
} from '../leaderboard/store';

const IDLE_ATTRACT_MS = 90_000;
const IDLE_MID_GAME_MS = 120_000;
const IDLE_NAME_ENTRY_MS = 180_000;
const IDLE_HELP_MS = 240_000;

export type UseBoothSessionOptions = {
  board: LeaderboardStore;
  /** A game is underway: idle deals a fresh board rather than going to attract. */
  inProgress: boolean;
  /** The game ended in a win that belongs on the board: idle waits much longer. */
  awaitingName: boolean;
  /** Throw away whatever is on screen and deal a fresh game. */
  onNewGame: () => void;
};

export type BoothSession = {
  entries: LeaderboardEntry[];
  submitted: SubmittedRun | null;
  submitName: (name: string, value: number) => void;
  newGame: () => void;
  attract: boolean;
  showAttract: () => void;
  dismissAttract: () => void;
  help: boolean;
  openHelp: () => void;
  closeHelp: () => void;
};

/**
 * Everything an unattended booth screen needs that is not the game itself: the
 * leaderboard, the attract overlay, the help dialog, the idle timers that hand the
 * screen back to the next visitor, and the volunteer's escape hatch.
 *
 * It owns `submitted` — which is why it decides when name entry is open rather than
 * being told — so that dealing a new game cannot forget to clear the last result.
 */
export function useBoothSession({
  board,
  inProgress,
  awaitingName,
  onNewGame,
}: UseBoothSessionOptions): BoothSession {
  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => board.list());
  const [submitted, setSubmitted] = useState<SubmittedRun | null>(null);
  const [attract, setAttract] = useState(true);
  const [help, setHelp] = useState(false);

  const deal = useRef(onNewGame);
  deal.current = onNewGame;

  const newGame = useCallback(() => {
    deal.current();
    setSubmitted(null);
  }, []);

  const nameEntryOpen = awaitingName && submitted === null;

  useIdle({
    delayMs: help
      ? IDLE_HELP_MS
      : nameEntryOpen
        ? IDLE_NAME_ENTRY_MS
        : inProgress
          ? IDLE_MID_GAME_MS
          : IDLE_ATTRACT_MS,
    enabled: !attract,
    // An abandoned game gets a fresh board first; if nobody takes that either, the
    // screen falls back to attract. Either way the booth is always ready.
    onIdle: () => {
      setHelp(false);
      if (inProgress) newGame();
      else setAttract(true);
    },
  });

  // Volunteer-only, deliberately undiscoverable: clears the board between events.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'k')) return;
      event.preventDefault();
      if (window.confirm('Clear the leaderboard?')) {
        board.clear();
        setEntries([]);
        setSubmitted(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [board]);

  const submitName = useCallback(
    (name: string, value: number) => {
      const result = board.submit(name, value);
      setEntries(result.entries);
      setSubmitted({ rank: result.rank, total: result.total, at: result.entry.at });
    },
    [board],
  );

  const showAttract = useCallback(() => setAttract(true), []);
  const dismissAttract = useCallback(() => {
    setAttract(false);
    newGame();
  }, [newGame]);
  const openHelp = useCallback(() => setHelp(true), []);
  const closeHelp = useCallback(() => setHelp(false), []);

  return {
    entries,
    submitted,
    submitName,
    newGame,
    attract,
    showAttract,
    dismissAttract,
    help,
    openHelp,
    closeHelp,
  };
}
