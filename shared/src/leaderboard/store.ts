export type LeaderboardEntry = {
  name: string;
  value: number;
  at: number;
};

/** What a submission came back as, kept around to highlight the visitor's own row. */
export type SubmittedRun = {
  rank: number;
  total: number;
  at: number;
};

export type LeaderboardOptions = {
  /** Namespaced per interactive, e.g. 'nim.v1'. Bump the suffix to reset a board. */
  key: string;
  /** 'asc' ranks low values first (times); 'desc' ranks high values first (scores). */
  order?: 'asc' | 'desc';
  limit?: number;
};

export type Leaderboard = {
  list: () => LeaderboardEntry[];
  submit: (
    name: string,
    value: number,
  ) => {
    rank: number;
    /** Everyone who has ever submitted, including entries past the cap. */
    total: number;
    entry: LeaderboardEntry;
    entries: LeaderboardEntry[];
  };
  clear: () => void;
};

const NAMESPACE = 'cpatgt:leaderboard:';

function isEntry(value: unknown): value is LeaderboardEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e['name'] === 'string' &&
    typeof e['value'] === 'number' &&
    Number.isFinite(e['value']) &&
    typeof e['at'] === 'number'
  );
}

/**
 * localStorage-backed ranked list. Every access is guarded: a booth browser in
 * private mode, or one that has hit its quota, throws on both read and write, and
 * an interactive that crashes on a leaderboard is worse than one without a board.
 * On failure we fall back to an in-memory list that lasts the session.
 */
export function createLeaderboard(options: LeaderboardOptions): Leaderboard {
  const { key, order = 'asc', limit = 100 } = options;
  const storageKey = NAMESPACE + key;

  let memory: LeaderboardEntry[] = [];
  let usingMemory = false;

  const sort = (entries: LeaderboardEntry[]): LeaderboardEntry[] =>
    [...entries].sort((a, b) => {
      const byValue = order === 'asc' ? a.value - b.value : b.value - a.value;
      // Earlier submission wins ties: first to get there keeps the higher rank.
      return byValue !== 0 ? byValue : a.at - b.at;
    });

  const read = (): LeaderboardEntry[] => {
    if (usingMemory) return memory;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isEntry);
    } catch {
      usingMemory = true;
      return memory;
    }
  };

  const write = (entries: LeaderboardEntry[]): void => {
    memory = entries;
    if (usingMemory) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      usingMemory = true;
    }
  };

  return {
    list: () => sort(read()),

    submit: (name, value) => {
      const entry: LeaderboardEntry = { name, value, at: Date.now() };
      const ranked = sort([...read(), entry]);
      const rank = ranked.indexOf(entry) + 1;
      const kept = ranked.slice(0, limit);
      write(kept);
      return { rank, total: ranked.length, entry, entries: kept };
    },

    clear: () => {
      memory = [];
      try {
        localStorage.removeItem(storageKey);
      } catch {
        usingMemory = true;
      }
    },
  };
}
