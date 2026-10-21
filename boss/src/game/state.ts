import { classify, type Table } from './boss';
import type { Level, Opening } from './levels';

export type Phase = 'playing' | 'botThinking' | 'won' | 'lost';

export type Hit = {
  readonly by: 'you' | 'bot';
  readonly hit: number;
};

export type PickState = {
  readonly screen: 'pick';
};

export type GameState = {
  readonly screen: 'game';
  readonly level: Level;
  readonly opening: Opening;
  readonly table: Table;
  readonly phase: Phase;
  readonly health: number;
  /** The amount just dealt by the other side, which this side may not repeat. */
  readonly forbidden: number;
  /** A hit the visitor has picked but not yet confirmed. */
  readonly staged: number | null;
  readonly history: readonly Hit[];
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
};

export type State = PickState | GameState;

export type Action =
  | { type: 'pick'; level: Level; opening: Opening }
  | { type: 'stage'; hit: number | null }
  | { type: 'tap'; hit: number }
  | { type: 'commit'; hit: number }
  | { type: 'bot'; hit: number }
  | { type: 'changeLevel' };

export function initialState(): State {
  return { screen: 'pick' };
}

export function startGame(level: Level, opening: Opening): GameState {
  return {
    screen: 'game',
    level,
    opening,
    table: classify(opening.m, opening.health),
    phase: 'playing',
    health: opening.health,
    forbidden: 0,
    staged: null,
    history: [],
    startedAt: null,
    finishedAt: null,
  };
}

export function isLegal(state: GameState, hit: number): boolean {
  return Number.isInteger(hit) && hit >= 1 && hit <= state.opening.m && hit !== state.forbidden;
}

export function reducer(state: State, action: Action): State {
  if (action.type === 'pick') return startGame(action.level, action.opening);
  if (action.type === 'changeLevel') return initialState();
  if (state.screen !== 'game') return state;

  switch (action.type) {
    case 'stage':
      if (state.phase !== 'playing') return state;
      if (action.hit !== null && !isLegal(state, action.hit)) return state;
      return { ...state, staged: action.hit };

    /**
     * A touch tap: stage the hit, or commit it if it is already staged. Decided here
     * rather than in the component, which is the only place guaranteed to see the
     * current staged value rather than one render's worth of stale closure.
     */
    case 'tap':
      if (state.phase !== 'playing' || !isLegal(state, action.hit)) return state;
      return state.staged === action.hit
        ? reducer(state, { type: 'commit', hit: action.hit })
        : { ...state, staged: action.hit };

    case 'commit': {
      if (state.phase !== 'playing' || !isLegal(state, action.hit)) return state;
      const health = state.health - action.hit;
      const finished = health <= 0;
      return {
        ...state,
        phase: finished ? 'won' : 'botThinking',
        health,
        forbidden: action.hit,
        staged: null,
        history: [...state.history, { by: 'you', hit: action.hit }],
        startedAt: state.startedAt ?? Date.now(),
        finishedAt: finished ? Date.now() : null,
      };
    }

    case 'bot': {
      if (state.phase !== 'botThinking' || !isLegal(state, action.hit)) return state;
      const health = state.health - action.hit;
      const finished = health <= 0;
      return {
        ...state,
        phase: finished ? 'lost' : 'playing',
        health,
        forbidden: action.hit,
        history: [...state.history, { by: 'bot', hit: action.hit }],
        finishedAt: finished ? Date.now() : null,
      };
    }
  }
}
