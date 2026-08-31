import { applyMove, isOver, winningMoves, type Heaps, type Move } from './nim';

export type Phase = 'playing' | 'botThinking' | 'won' | 'lost';

/** A pending take: this stone and everything after it in the row. */
export type Selection = {
  row: number;
  from: number;
};

export type GameState = {
  opening: Heaps;
  heaps: Heaps;
  phase: Phase;
  selection: Selection | null;
  /** Where the most recent take started, so its stones can leave in sequence. */
  lastRemoved: Selection | null;
  lastMove: { by: 'you' | 'bot'; move: Move } | null;
  hint: Move | null;
  hintUsed: boolean;
  /** A hint was asked for in a position that is already lost. */
  hintRefused: boolean;
  /**
   * The closing take has finished leaving the board. The result panel replaces the
   * board, so it has to wait for this or the last stones vanish with it.
   */
  settled: boolean;
  startedAt: number | null;
  finishedAt: number | null;
};

export type GameAction =
  | { type: 'new'; heaps: Heaps }
  | { type: 'select'; selection: Selection | null }
  | { type: 'commit'; selection: Selection }
  | { type: 'tap'; selection: Selection }
  | { type: 'bot'; move: Move }
  | { type: 'hint' }
  | { type: 'settle' };

export function initialState(heaps: Heaps): GameState {
  return {
    opening: heaps,
    heaps,
    phase: 'playing',
    selection: null,
    lastRemoved: null,
    lastMove: null,
    hint: null,
    hintUsed: false,
    hintRefused: false,
    settled: false,
    startedAt: null,
    finishedAt: null,
  };
}

export function selectionToMove(heaps: Heaps, selection: Selection): Move {
  const remaining = heaps[selection.row] ?? 0;
  return { row: selection.row, count: remaining - selection.from };
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'new':
      return initialState(action.heaps);

    case 'select':
      if (state.phase !== 'playing') return state;
      return { ...state, selection: action.selection };

    case 'commit': {
      if (state.phase !== 'playing') return state;
      const move = selectionToMove(state.heaps, action.selection);
      if (move.count < 1) return state;

      const heaps = applyMove(state.heaps, move);
      const finished = isOver(heaps);

      return {
        ...state,
        heaps,
        phase: finished ? 'won' : 'botThinking',
        selection: null,
        lastRemoved: action.selection,
        lastMove: { by: 'you', move },
        hint: null,
        hintRefused: false,
        startedAt: state.startedAt ?? Date.now(),
        finishedAt: finished ? Date.now() : null,
      };
    }

    /**
     * A touch tap: stage the take, or commit it if this stone is already staged.
     * The decision lives here rather than in the component because the reducer is
     * the only place guaranteed to see the current selection — a handler closing
     * over `state.selection` can be one render stale, and two taps that land in the
     * same batch would then both stage instead of staging and committing.
     */
    case 'tap': {
      if (state.phase !== 'playing') return state;
      const staged = state.selection;
      const same =
        staged !== null &&
        staged.row === action.selection.row &&
        staged.from === action.selection.from;
      return same
        ? reducer(state, { type: 'commit', selection: action.selection })
        : { ...state, selection: action.selection };
    }

    case 'bot': {
      if (state.phase !== 'botThinking') return state;
      const heaps = applyMove(state.heaps, action.move);
      const finished = isOver(heaps);

      return {
        ...state,
        heaps,
        phase: finished ? 'lost' : 'playing',
        lastRemoved: { row: action.move.row, from: heaps[action.move.row] ?? 0 },
        lastMove: { by: 'bot', move: action.move },
        finishedAt: finished ? Date.now() : null,
      };
    }

    case 'hint': {
      if (state.phase !== 'playing') return state;
      const winning = winningMoves(state.heaps);
      const best = winning[0];
      return best === undefined
        ? { ...state, hint: null, hintUsed: true, hintRefused: true }
        : { ...state, hint: best, hintUsed: true, hintRefused: false };
    }

    case 'settle':
      if (state.phase !== 'won' && state.phase !== 'lost') return state;
      return state.settled ? state : { ...state, settled: true };
  }
}
