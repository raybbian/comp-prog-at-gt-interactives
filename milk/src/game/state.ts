import {
  emptyLoading,
  isIn,
  type Loading,
  MAX_KITS,
  MIN_KITS,
  samplesLoaded,
  setIn,
  START_KITS,
  truncateTo,
} from './buckets';

export type Phase = 'loading' | 'running' | 'naming' | 'won' | 'lost';

export type GameState = {
  loading: Loading;
  /** How many kits the visitor has decided to use. */
  kitCount: number;
  /** The results as a bitmask, once the kits have run. */
  pattern: number | null;
  /** Buckets the results still fit. */
  candidates: readonly number[];
  /** How many kit results have landed; they arrive one at a time. */
  revealed: number;
  /** The bucket lined up to be named. */
  selection: number | null;
  named: number | null;
  culprit: number | null;
  phase: Phase;
  startedAt: number | null;
  finishedAt: number | null;
};

export type GameAction =
  | { type: 'new' }
  | { type: 'load'; bucket: number; kit: number; on: boolean }
  | { type: 'addKit' }
  | { type: 'removeKit' }
  | { type: 'clear' }
  | { type: 'run'; pattern: number; candidates: number[] }
  | { type: 'revealNext' }
  | { type: 'select'; bucket: number | null }
  | { type: 'name'; bucket: number; culprit: number };

export function initialState(): GameState {
  return {
    loading: emptyLoading(),
    kitCount: START_KITS,
    pattern: null,
    candidates: [],
    revealed: 0,
    selection: null,
    named: null,
    culprit: null,
    phase: 'loading',
    startedAt: null,
    finishedAt: null,
  };
}

export function canRun(state: GameState): boolean {
  return state.phase === 'loading' && samplesLoaded(state.loading, state.kitCount) > 0;
}

export function canAddKit(state: GameState): boolean {
  return state.phase === 'loading' && state.kitCount < MAX_KITS;
}

/** The last kit can go back as long as nothing has been poured into it. */
export function canRemoveKit(state: GameState): boolean {
  return (
    state.phase === 'loading' &&
    state.kitCount > MIN_KITS &&
    !state.loading.some((_, bucket) => isIn(state.loading, bucket, state.kitCount - 1))
  );
}

export function canName(state: GameState): boolean {
  return state.phase === 'naming' && state.selection !== null;
}

/** Everything is locked in once the kits have run; there is no second attempt. */
export function isLocked(state: GameState): boolean {
  return state.phase !== 'loading';
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'new':
      return initialState();

    case 'load': {
      if (state.phase !== 'loading') return state;
      if (action.kit >= state.kitCount) return state;
      if (isIn(state.loading, action.bucket, action.kit) === action.on) return state;

      return {
        ...state,
        // Set membership rather than a toggle, so a drag that re-enters a cell it
        // already covered does not flip it back off.
        loading: setIn(state.loading, action.bucket, action.kit, action.on),
        startedAt: state.startedAt ?? Date.now(),
      };
    }

    case 'addKit':
      if (!canAddKit(state)) return state;
      return {
        ...state,
        kitCount: state.kitCount + 1,
        startedAt: state.startedAt ?? Date.now(),
      };

    case 'removeKit': {
      if (!canRemoveKit(state)) return state;
      const kitCount = state.kitCount - 1;
      return {
        ...state,
        kitCount,
        loading: truncateTo(state.loading, kitCount),
      };
    }

    case 'clear':
      if (state.phase !== 'loading') return state;
      return { ...state, loading: emptyLoading() };

    case 'run':
      if (!canRun(state)) return state;
      return {
        ...state,
        phase: 'running',
        pattern: action.pattern,
        candidates: action.candidates,
        revealed: 0,
      };

    case 'revealNext': {
      if (state.phase !== 'running') return state;
      const revealed = state.revealed + 1;
      return {
        ...state,
        revealed,
        phase: revealed >= state.kitCount ? 'naming' : 'running',
      };
    }

    case 'select':
      if (state.phase !== 'naming') return state;
      return { ...state, selection: action.bucket };

    case 'name': {
      if (state.phase !== 'naming') return state;
      const now = Date.now();
      return {
        ...state,
        phase: action.bucket === action.culprit ? 'won' : 'lost',
        named: action.bucket,
        culprit: action.culprit,
        selection: null,
        startedAt: state.startedAt ?? now,
        finishedAt: now,
      };
    }

  }
}
