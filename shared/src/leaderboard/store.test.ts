import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLeaderboard } from './store';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function throwingStorage(): Storage {
  const boom = (): never => {
    throw new DOMException('quota', 'QuotaExceededError');
  };
  return {
    get length(): number {
      return boom();
    },
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  };
}

function setStorage(storage: Storage): void {
  vi.stubGlobal('localStorage', storage);
}

/** Submissions land in distinct milliseconds so tie-breaks are testable. */
function withClock(): () => void {
  let now = 1_000;
  const spy = vi.spyOn(Date, 'now').mockImplementation(() => (now += 1));
  return () => spy.mockRestore();
}

describe('createLeaderboard', () => {
  let restoreClock: () => void;

  beforeEach(() => {
    setStorage(fakeStorage());
    restoreClock = withClock();
  });

  afterEach(() => {
    restoreClock();
    vi.unstubAllGlobals();
  });

  it('ranks ascending for times', () => {
    const board = createLeaderboard({ key: 'test' });
    board.submit('SLOW', 9000);
    board.submit('FAST', 1000);
    board.submit('MID', 4000);

    expect(board.list().map((e) => e.name)).toEqual(['FAST', 'MID', 'SLOW']);
  });

  it('ranks descending when asked', () => {
    const board = createLeaderboard({ key: 'test', order: 'desc' });
    board.submit('LOW', 10);
    board.submit('HIGH', 99);

    expect(board.list().map((e) => e.name)).toEqual(['HIGH', 'LOW']);
  });

  it('reports the rank of the entry just submitted', () => {
    const board = createLeaderboard({ key: 'test' });
    board.submit('A', 500);
    board.submit('C', 1500);

    expect(board.submit('B', 1000).rank).toBe(2);
    expect(board.submit('FIRST', 1).rank).toBe(1);
  });

  it('gives an equal value to whoever got there first', () => {
    const board = createLeaderboard({ key: 'test' });
    board.submit('EARLY', 3000);
    const later = board.submit('LATE', 3000);

    expect(later.rank).toBe(2);
    expect(board.list().map((e) => e.name)).toEqual(['EARLY', 'LATE']);
  });

  it('keeps only the configured number of entries', () => {
    const board = createLeaderboard({ key: 'test', limit: 3 });
    for (let i = 10; i >= 1; i -= 1) board.submit(`P${i}`, i * 100);

    const entries = board.list();
    expect(entries.length).toBe(3);
    expect(entries.map((e) => e.name)).toEqual(['P1', 'P2', 'P3']);
  });

  it('persists across instances sharing a key, and isolates different keys', () => {
    createLeaderboard({ key: 'nim.v1' }).submit('SAVED', 100);

    expect(createLeaderboard({ key: 'nim.v1' }).list().map((e) => e.name)).toEqual([
      'SAVED',
    ]);
    expect(createLeaderboard({ key: 'other.v1' }).list()).toEqual([]);
  });

  it('clears', () => {
    const board = createLeaderboard({ key: 'test' });
    board.submit('GONE', 100);
    board.clear();

    expect(board.list()).toEqual([]);
  });

  it('ignores corrupt or foreign data instead of throwing', () => {
    const storage = fakeStorage();
    setStorage(storage);
    storage.setItem('cpatgt:leaderboard:test', '{ not json');
    expect(createLeaderboard({ key: 'test' }).list()).toEqual([]);

    storage.setItem(
      'cpatgt:leaderboard:test',
      JSON.stringify([{ name: 'OK', value: 5, at: 1 }, { name: 'BAD' }, 42]),
    );
    expect(createLeaderboard({ key: 'test' }).list().map((e) => e.name)).toEqual(['OK']);
  });

  it('falls back to memory when storage is unavailable', () => {
    setStorage(throwingStorage());
    const board = createLeaderboard({ key: 'test' });

    expect(() => board.submit('PRIVATE', 100)).not.toThrow();
    expect(board.list().map((e) => e.name)).toEqual(['PRIVATE']);
    expect(() => board.clear()).not.toThrow();
    expect(board.list()).toEqual([]);
  });
});

describe('rank totals', () => {
  it('counts everyone who submitted, not just the entries it kept', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const restore = withClock();
    const board = createLeaderboard({ key: 'capped', limit: 2 });

    board.submit('A', 100);
    board.submit('B', 200);
    const third = board.submit('C', 300);

    expect(third.rank).toBe(3);
    expect(third.total).toBe(3);
    expect(third.entries.length).toBe(2);

    restore();
    vi.unstubAllGlobals();
  });
});
