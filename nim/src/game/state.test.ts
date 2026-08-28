import { describe, expect, it } from 'vitest';
import { initialState, reducer, selectionToMove, type GameState } from './state';

const commit = (state: GameState, row: number, from: number): GameState =>
  reducer(state, { type: 'commit', selection: { row, from } });

describe('selectionToMove', () => {
  it('takes the chosen stone and everything after it in the row', () => {
    expect(selectionToMove([1, 4, 6], { row: 2, from: 3 })).toEqual({ row: 2, count: 3 });
    expect(selectionToMove([1, 4, 6], { row: 1, from: 0 })).toEqual({ row: 1, count: 4 });
  });
});

describe('reducer', () => {
  it('starts the clock on the first move, not on deal', () => {
    const fresh = initialState([1, 4, 6]);
    expect(fresh.startedAt).toBeNull();
    expect(commit(fresh, 2, 5).startedAt).not.toBeNull();
  });

  it('hands the turn to the bot and remembers the take', () => {
    const after = commit(initialState([1, 4, 6]), 2, 5);

    expect(after.heaps).toEqual([1, 4, 5]);
    expect(after.phase).toBe('botThinking');
    expect(after.lastMove).toEqual({ by: 'you', move: { row: 2, count: 1 } });
    expect(after.lastRemoved).toEqual({ row: 2, from: 5 });
    expect(after.selection).toBeNull();
  });

  it('stages a tap, then commits when the same stone is tapped again', () => {
    const fresh = initialState([1, 4, 6]);
    const staged = reducer(fresh, { type: 'tap', selection: { row: 2, from: 5 } });

    expect(staged.selection).toEqual({ row: 2, from: 5 });
    expect(staged.heaps).toEqual([1, 4, 6]);

    const committed = reducer(staged, { type: 'tap', selection: { row: 2, from: 5 } });
    expect(committed.heaps).toEqual([1, 4, 5]);
    expect(committed.selection).toBeNull();
  });

  it('restages rather than committing when a tap lands on a different stone', () => {
    const staged = reducer(initialState([1, 4, 6]), {
      type: 'tap',
      selection: { row: 2, from: 5 },
    });
    const moved = reducer(staged, { type: 'tap', selection: { row: 1, from: 2 } });

    expect(moved.selection).toEqual({ row: 1, from: 2 });
    expect(moved.heaps).toEqual([1, 4, 6]);
  });

  it('declares a win when the visitor takes the last stone', () => {
    const state = { ...initialState([0, 0, 1]), startedAt: Date.now() - 5000 };
    const after = commit(state, 2, 0);

    expect(after.phase).toBe('won');
    expect(after.finishedAt).not.toBeNull();
  });

  it('declares a loss when the bot takes the last stone', () => {
    const state: GameState = { ...initialState([0, 0, 1]), phase: 'botThinking' };
    const after = reducer(state, { type: 'bot', move: { row: 2, count: 1 } });

    expect(after.phase).toBe('lost');
    expect(after.lastMove).toEqual({ by: 'bot', move: { row: 2, count: 1 } });
  });

  it('offers a hint only while one exists, and says so when none does', () => {
    const winnable = reducer(initialState([1, 4, 6]), { type: 'hint' });
    expect(winnable.hint).not.toBeNull();
    expect(winnable.hintUsed).toBe(true);
    expect(winnable.hintRefused).toBe(false);

    const lost = reducer(initialState([1, 3, 5, 7]), { type: 'hint' });
    expect(lost.hint).toBeNull();
    expect(lost.hintUsed).toBe(true);
    expect(lost.hintRefused).toBe(true);
  });

  it('ignores input that does not belong to the current phase', () => {
    const thinking: GameState = { ...initialState([1, 4, 6]), phase: 'botThinking' };
    expect(commit(thinking, 2, 5)).toBe(thinking);
    expect(reducer(thinking, { type: 'select', selection: { row: 0, from: 0 } })).toBe(
      thinking,
    );

    const playing = initialState([1, 4, 6]);
    expect(reducer(playing, { type: 'bot', move: { row: 0, count: 1 } })).toBe(playing);
  });

  it('deals a clean slate on a new game', () => {
    const messy = reducer(commit(initialState([1, 4, 6]), 0, 0), { type: 'hint' });
    const fresh = reducer(messy, { type: 'new', heaps: [2, 3, 7] });

    expect(fresh).toEqual(initialState([2, 3, 7]));
  });
});
