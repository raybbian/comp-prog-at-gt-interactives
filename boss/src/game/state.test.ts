import { describe, expect, it } from 'vitest';
import { initialState, reducer, startGame, type GameState, type State } from './state';

const OPENING = { health: 20, m: 4 };

function fresh(): GameState {
  return startGame('easy', OPENING);
}

function game(state: State): GameState {
  if (state.screen !== 'game') throw new Error('expected a game');
  return state;
}

describe('reducer', () => {
  it('starts on the level picker and enters a game on pick', () => {
    expect(initialState()).toEqual({ screen: 'pick' });
    const started = game(reducer(initialState(), { type: 'pick', level: 'easy', opening: OPENING }));
    expect(started.health).toBe(20);
    expect(started.phase).toBe('playing');
    expect(started.forbidden).toBe(0);
    expect(started.table.kind.length).toBe(21);
  });

  it('starts the clock on the first hit, not on pick', () => {
    expect(fresh().startedAt).toBeNull();
    expect(game(reducer(fresh(), { type: 'commit', hit: 3 })).startedAt).not.toBeNull();
  });

  it('hands the turn to the bot and forbids the hit just made', () => {
    const after = game(reducer(fresh(), { type: 'commit', hit: 3 }));
    expect(after.health).toBe(17);
    expect(after.phase).toBe('botThinking');
    expect(after.forbidden).toBe(3);
    expect(after.staged).toBeNull();
    expect(after.history).toEqual([{ by: 'you', hit: 3 }]);
  });

  it('stages a tap, then commits when the same key is tapped again', () => {
    const staged = game(reducer(fresh(), { type: 'tap', hit: 2 }));
    expect(staged.staged).toBe(2);
    expect(staged.health).toBe(20);

    const other = game(reducer(staged, { type: 'tap', hit: 4 }));
    expect(other.staged).toBe(4);
    expect(other.health).toBe(20);

    const committed = game(reducer(other, { type: 'tap', hit: 4 }));
    expect(committed.health).toBe(16);
    expect(committed.staged).toBeNull();
  });

  it('refuses the forbidden amount and amounts off the pad', () => {
    const thinking = game(reducer(fresh(), { type: 'commit', hit: 3 }));
    const playing = game(reducer(thinking, { type: 'bot', hit: 2 }));
    expect(playing.phase).toBe('playing');
    expect(playing.forbidden).toBe(2);
    expect(reducer(playing, { type: 'commit', hit: 2 })).toBe(playing);
    expect(reducer(playing, { type: 'stage', hit: 2 })).toBe(playing);
    expect(reducer(playing, { type: 'commit', hit: 5 })).toBe(playing);
    expect(reducer(playing, { type: 'commit', hit: 0 })).toBe(playing);
  });

  it('declares a win when the visitor lands the finishing blow', () => {
    const state: GameState = { ...fresh(), health: 3, startedAt: Date.now() - 5000 };
    const after = game(reducer(state, { type: 'commit', hit: 4 }));
    expect(after.phase).toBe('won');
    expect(after.health).toBe(-1);
    expect(after.finishedAt).not.toBeNull();
  });

  it('declares a loss when the bot lands it', () => {
    const state: GameState = { ...fresh(), health: 2, phase: 'botThinking', forbidden: 1 };
    const after = game(reducer(state, { type: 'bot', hit: 2 }));
    expect(after.phase).toBe('lost');
    expect(after.history).toEqual([{ by: 'bot', hit: 2 }]);
  });

  it('holds the bot to the same rule', () => {
    const state: GameState = { ...fresh(), phase: 'botThinking', forbidden: 3 };
    expect(reducer(state, { type: 'bot', hit: 3 })).toBe(state);
  });

  it('ignores input that does not belong to the current phase', () => {
    const thinking: GameState = { ...fresh(), phase: 'botThinking', forbidden: 1 };
    expect(reducer(thinking, { type: 'commit', hit: 2 })).toBe(thinking);
    expect(reducer(thinking, { type: 'tap', hit: 2 })).toBe(thinking);
    expect(reducer(thinking, { type: 'stage', hit: 2 })).toBe(thinking);

    const playing = fresh();
    expect(reducer(playing, { type: 'bot', hit: 1 })).toBe(playing);

    const pick = initialState();
    expect(reducer(pick, { type: 'commit', hit: 1 })).toBe(pick);
  });

  it('goes back to the picker on change level', () => {
    expect(reducer(fresh(), { type: 'changeLevel' })).toEqual({ screen: 'pick' });
  });
});
