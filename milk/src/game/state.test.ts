import { describe, expect, it } from 'vitest';
import {
  binaryLoading,
  isIn,
  KITS_NEEDED,
  MAX_KITS,
  MIN_KITS,
  samplesLoaded,
  START_KITS,
} from './buckets';
import { decodeScore, encodeScore, formatScore } from './score';
import {
  canAddKit,
  canName,
  canRemoveKit,
  canRun,
  initialState,
  isLocked,
  reducer,
  type GameState,
} from './state';

const load = (state: GameState, bucket: number, kit: number, on = true): GameState =>
  reducer(state, { type: 'load', bucket, kit, on });

const addKits = (state: GameState, n: number): GameState =>
  Array.from({ length: n }).reduce<GameState>(
    (acc) => reducer(acc, { type: 'addKit' }),
    state,
  );

/** Runs the kits and lets every result land. */
function runKits(state: GameState, pattern: number, candidates: number[]): GameState {
  let next = reducer(state, { type: 'run', pattern, candidates });
  for (let kit = 0; kit < state.kitCount; kit += 1) {
    next = reducer(next, { type: 'revealNext' });
  }
  return next;
}

/** A game played to the naming step with five kits that tell every bucket apart. */
function playedWell(): GameState {
  let state = addKits(initialState(), KITS_NEEDED - START_KITS);
  for (const [bucket, mask] of binaryLoading().entries()) {
    for (let kit = 0; kit < KITS_NEEDED; kit += 1) {
      if (((mask >> kit) & 1) === 1) state = load(state, bucket, kit);
    }
  }
  return runKits(state, 11, [11]);
}

describe('reducer', () => {
  it('deals an empty grid with the starting number of kits', () => {
    const fresh = initialState();
    expect(fresh.kitCount).toBe(START_KITS);
    expect(samplesLoaded(fresh.loading, fresh.kitCount)).toBe(0);
    expect(fresh.phase).toBe('loading');
    expect(fresh.startedAt).toBeNull();
    expect(isLocked(fresh)).toBe(false);
  });

  it('loads by membership, so a drag back over a cell does not flip it off', () => {
    const once = load(initialState(), 3, 0);
    expect(isIn(once.loading, 3, 0)).toBe(true);
    expect(load(once, 3, 0)).toBe(once);

    expect(isIn(load(once, 3, 0, false).loading, 3, 0)).toBe(false);
  });

  it('refuses to load a kit that has not been added yet', () => {
    const fresh = initialState();
    expect(load(fresh, 0, START_KITS)).toBe(fresh);
  });

  it('adds kits up to the cap', () => {
    let state = initialState();
    expect(canAddKit(state)).toBe(true);

    state = addKits(state, MAX_KITS - START_KITS);
    expect(state.kitCount).toBe(MAX_KITS);
    expect(canAddKit(state)).toBe(false);
    expect(reducer(state, { type: 'addKit' })).toBe(state);
  });

  it('takes an unused kit back, but never one with milk in it', () => {
    const two = addKits(initialState(), 1);
    expect(canRemoveKit(two)).toBe(true);
    expect(reducer(two, { type: 'removeKit' }).kitCount).toBe(MIN_KITS);

    const used = load(two, 4, 1);
    expect(canRemoveKit(used)).toBe(false);
    expect(reducer(used, { type: 'removeKit' })).toBe(used);
  });

  it('never goes below one kit', () => {
    const fresh = initialState();
    expect(canRemoveKit(fresh)).toBe(false);
    expect(reducer(fresh, { type: 'removeKit' })).toBe(fresh);
  });

  it('starts the clock on the first thing the visitor does', () => {
    expect(initialState().startedAt).toBeNull();
    expect(load(initialState(), 0, 0).startedAt).not.toBeNull();
    // Adding a kit is a decision too, and it is the first move some people make.
    expect(reducer(initialState(), { type: 'addKit' }).startedAt).not.toBeNull();
  });

  it('clears the grid without touching the kits or the clock', () => {
    const messy = load(addKits(initialState(), 2), 5, 2);
    const cleared = reducer(messy, { type: 'clear' });

    expect(samplesLoaded(cleared.loading, cleared.kitCount)).toBe(0);
    expect(cleared.kitCount).toBe(messy.kitCount);
    expect(cleared.startedAt).toBe(messy.startedAt);
  });

  it('will not run the kits on an empty grid', () => {
    const fresh = initialState();
    expect(canRun(fresh)).toBe(false);
    expect(reducer(fresh, { type: 'run', pattern: 0, candidates: [] })).toBe(fresh);

    expect(canRun(load(fresh, 0, 0))).toBe(true);
  });

  it('reveals one result per kit in play, then asks for a name', () => {
    let state = reducer(load(addKits(initialState(), 2), 0, 0), {
      type: 'run',
      pattern: 0b001,
      candidates: [0],
    });

    expect(state.phase).toBe('running');
    for (let kit = 1; kit <= 3; kit += 1) {
      state = reducer(state, { type: 'revealNext' });
      expect(state.revealed).toBe(kit);
      expect(state.phase).toBe(kit === 3 ? 'naming' : 'running');
    }

    expect(reducer(state, { type: 'revealNext' })).toBe(state);
  });

  it('locks everything the moment the kits run', () => {
    const running = reducer(load(initialState(), 0, 0), {
      type: 'run',
      pattern: 0,
      candidates: [1],
    });

    expect(isLocked(running)).toBe(true);
    expect(reducer(running, { type: 'load', bucket: 5, kit: 0, on: true })).toBe(running);
    expect(reducer(running, { type: 'clear' })).toBe(running);
    expect(reducer(running, { type: 'addKit' })).toBe(running);
    expect(reducer(running, { type: 'removeKit' })).toBe(running);
  });

  it('only takes a selection once the results are in', () => {
    expect(reducer(load(initialState(), 0, 0), { type: 'select', bucket: 4 }).selection)
      .toBeNull();

    const ready = playedWell();
    expect(canName(ready)).toBe(false);
    expect(canName(reducer(ready, { type: 'select', bucket: 11 }))).toBe(true);
  });

  it('settles the game on a name, right or wrong', () => {
    const ready = reducer(playedWell(), { type: 'select', bucket: 11 });

    const won = reducer(ready, { type: 'name', bucket: 11, culprit: 11 });
    expect(won.phase).toBe('won');
    expect(won.finishedAt).not.toBeNull();

    const lost = reducer(ready, { type: 'name', bucket: 11, culprit: 4 });
    expect(lost.phase).toBe('lost');
    expect(lost.named).toBe(11);
    expect(lost.culprit).toBe(4);
  });






  it('deals a clean slate on a new game', () => {
    const messy = reducer(playedWell(), { type: 'select', bucket: 11 });
    expect(reducer(messy, { type: 'new' })).toEqual(initialState());
  });
});

describe('scoring', () => {
  it('ranks fewer kits ahead of a faster time', () => {
    expect(encodeScore(5, 60_000)).toBeLessThan(encodeScore(6, 1));
  });

  it('uses time to break ties between equal kit counts', () => {
    expect(encodeScore(5, 1_000)).toBeLessThan(encodeScore(5, 2_000));
  });

  it('survives a round trip and a game left running for hours', () => {
    expect(decodeScore(encodeScore(5, 12_345))).toEqual({ kitsUsed: 5, elapsedMs: 12_345 });
    // Capped rather than allowed to overflow into the kit count.
    expect(decodeScore(encodeScore(5, 999_999_999)).kitsUsed).toBe(5);
  });

  it('shows both halves on the board', () => {
    expect(formatScore(encodeScore(5, 12_300))).toBe('5 · 0:12.3');
  });
});
