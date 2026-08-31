import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Size, bodyCells, paint } from '../protocol/grid.ts';
import { canExtend, orderPath } from '../protocol/paths.ts';
import { stashGrid, unstashGrid } from '../transport/client.ts';

/**
 * The receiver's drawing, and the rules that stop it going wrong.
 *
 * The editor knows the answer is an induced snake, so it will only ever let you draw one:
 * a swipe extends to a legal next cell or does nothing at all. That halves the number of
 * taps a hundred-cell snake needs, removes a whole class of "how did that get
 * disconnected" mistakes on a small screen — and, because an illegal drawing is not
 * expressible, it is also why the scorer never has to defend against a blank or
 * scribbled-over grid.
 *
 * On the round where both players are given the shape, the path is fixed and only the
 * levels move: there the snake is already drawn and the job is recolouring it.
 */

type Snapshot = { path: number[]; levels: number[] };

const HISTORY_LIMIT = 60;

export type SnakeEditor = {
  grid: string;
  path: readonly number[];
  levels: readonly number[];
  cursor: number;
  canUndo: boolean;
  canRedo: boolean;
  beginAt: (cell: number) => void;
  dragTo: (cell: number) => void;
  endStroke: () => void;
  setCursor: (index: number) => void;
  setLevelAt: (index: number, level: number) => void;
  bumpAt: (index: number, delta: number) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
};

export function useSnakeEditor(options: {
  size: Size;
  roundId: string;
  levels: number;
  /** Fixed on the shape-given round; null when the receiver draws the shape themselves. */
  fixedPath: readonly number[] | null;
  /** The server's copy, adopted whenever the round changes or the phone comes back. */
  serverGrid: string;
}): SnakeEditor {
  const { size, roundId, levels: levelCount, fixedPath, serverGrid } = options;

  const seed = useCallback((): Snapshot => {
    const stashed = unstashGrid(roundId);
    const source = stashed ?? serverGrid;
    if (fixedPath !== null) {
      return {
        path: [...fixedPath],
        levels: fixedPath.map((cell) => {
          const value = Number(source[cell] ?? '1');
          return Number.isFinite(value) && value >= 1 ? value : 1;
        }),
      };
    }
    const ordered = orderPath(size, bodyCells(source)) ?? [];
    return { path: ordered, levels: ordered.map(() => 1) };
  }, [fixedPath, roundId, serverGrid, size]);

  const [snapshot, setSnapshot] = useState<Snapshot>(seed);
  const [cursor, setCursor] = useState(0);
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  /** A whole drag is one undo entry, not one per cell. */
  const stroking = useRef(false);

  // A new round replaces the canvas outright. Anything else — a poll landing, a
  // reconnect — must not yank the drawing out from under a thumb mid-stroke.
  const lastRound = useRef(roundId);
  useEffect(() => {
    if (lastRound.current === roundId) return;
    lastRound.current = roundId;
    past.current = [];
    future.current = [];
    setSnapshot(seed());
    setCursor(0);
  }, [roundId, seed]);

  const grid = useMemo(
    () => paint(size, snapshot.path, snapshot.levels),
    [size, snapshot.levels, snapshot.path],
  );

  useEffect(() => {
    stashGrid(roundId, grid);
  }, [grid, roundId]);

  const commit = useCallback((next: Snapshot, newStroke: boolean) => {
    setSnapshot((current) => {
      if (newStroke || !stroking.current) {
        past.current = [...past.current, current].slice(-HISTORY_LIMIT);
        future.current = [];
      }
      return next;
    });
  }, []);

  const extend = useCallback(
    (cell: number, newStroke: boolean) => {
      if (fixedPath !== null) return;
      setSnapshot((current) => {
        const { path } = current;
        if (path.length === 0) {
          if (newStroke) {
            past.current = [...past.current, current].slice(-HISTORY_LIMIT);
            future.current = [];
          }
          return { path: [cell], levels: [1] };
        }
        if (path.includes(cell)) {
          // Tapping the tip takes it back — the natural undo when you overshoot.
          if (newStroke && cell === path[path.length - 1] && path.length > 0) {
            past.current = [...past.current, current].slice(-HISTORY_LIMIT);
            future.current = [];
            return { path: path.slice(0, -1), levels: current.levels.slice(0, -1) };
          }
          return current;
        }

        const occupied = new Set(path);
        const head = path[path.length - 1] as number;
        const tail = path[0] as number;

        if (canExtend(size, occupied, head, cell)) {
          if (newStroke) {
            past.current = [...past.current, current].slice(-HISTORY_LIMIT);
            future.current = [];
          }
          return { path: [...path, cell], levels: [...current.levels, 1] };
        }
        // Growing from the other end is just as valid a snake, and saves redrawing the
        // whole thing when you started from the wrong tip.
        if (canExtend(size, occupied, tail, cell)) {
          if (newStroke) {
            past.current = [...past.current, current].slice(-HISTORY_LIMIT);
            future.current = [];
          }
          return { path: [cell, ...path], levels: [1, ...current.levels] };
        }
        return current;
      });
    },
    [fixedPath, size],
  );

  const beginAt = useCallback(
    (cell: number) => {
      stroking.current = false;
      extend(cell, true);
      stroking.current = true;
    },
    [extend],
  );

  const dragTo = useCallback(
    (cell: number) => {
      if (!stroking.current) return;
      extend(cell, false);
    },
    [extend],
  );

  const endStroke = useCallback(() => {
    stroking.current = false;
  }, []);

  const setLevelAt = useCallback(
    (index: number, level: number) => {
      const clamped = Math.max(1, Math.min(levelCount, level));
      commit(
        {
          path: snapshot.path,
          levels: snapshot.levels.map((value, i) => (i === index ? clamped : value)),
        },
        true,
      );
    },
    [commit, levelCount, snapshot.levels, snapshot.path],
  );

  const bumpAt = useCallback(
    (index: number, delta: number) => {
      setLevelAt(index, (snapshot.levels[index] ?? 1) + delta);
    },
    [setLevelAt, snapshot.levels],
  );

  const undo = useCallback(() => {
    setSnapshot((current) => {
      const previous = past.current.pop();
      if (previous === undefined) return current;
      future.current = [...future.current, current].slice(-HISTORY_LIMIT);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setSnapshot((current) => {
      const next = future.current.pop();
      if (next === undefined) return current;
      past.current = [...past.current, current].slice(-HISTORY_LIMIT);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    if (fixedPath !== null) return;
    commit({ path: [], levels: [] }, true);
  }, [commit, fixedPath]);

  // On a round where the receiver draws the shape *and* colours it, the path grows and
  // shrinks under the cursor, so it is clamped on read rather than tracked on write.
  const safeCursor = Math.max(0, Math.min(cursor, snapshot.path.length - 1));

  return {
    grid,
    path: snapshot.path,
    levels: snapshot.levels,
    cursor: safeCursor,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    beginAt,
    dragTo,
    endStroke,
    setCursor,
    setLevelAt,
    bumpAt,
    undo,
    redo,
    clear,
  };
}
