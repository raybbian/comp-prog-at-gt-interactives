/**
 * The questions, minus the answers.
 *
 * **Nothing in this file may hint at what is wrong with the code.** It is bundled into
 * the client, so anything here is readable by a team with devtools open. The correct
 * complexity and the bug list live in `worker/answers.ts`, which Vite never sees — the
 * answer key is kept out of the client by *where it lives*, not by a filter someone has
 * to remember to apply. `questions.test.ts` asserts nothing under `src/` imports it.
 *
 * ## The ramp
 *
 * The first three are meant to be *easy*, and that is a deliberate use of a third of the
 * evening. A team that finds nothing on question one stops reading carefully and starts
 * guessing, and there is no recovering from that in twenty minutes. So the set opens on
 * an uninitialised variable and an integer division — bugs everyone in the room has
 * personally shipped — and the graph and the knapsack come after the habit of reading
 * line by line is established. The last two are where the evening is decided.
 *
 * A host may stop anywhere. An unplayed question scores zero for every team, so the
 * standings are valid whenever the room runs out of time, and the questions are ordered
 * so that stopping early costs the hardest ones rather than the fairest ones.
 *
 * ## Two rules every snippet obeys
 *
 * **Short.** Sixteen lines and sixty-four columns, checked by a test. A phone is 390
 * points wide and a team is reading this standing up; a snippet that needs two-finger
 * panning is a snippet nobody debugs. It also keeps the whole thing in working memory,
 * which is where finding an off-by-one actually happens.
 *
 * **No bug changes the asymptotic complexity.** Every question asks for the complexity
 * *and* for the bugs, and if a bug turned an O(n) loop into an infinite one the first
 * question would have no defensible answer. So the bugs are wrong answers, overflows,
 * truncating divisions, bad bounds and bad loop directions — never something that changes
 * the shape of the work. That is why no snippet here has an unterminated binary search,
 * which is otherwise the most tempting bug in the genre.
 */

/**
 * Strips the common indentation off a template literal and trims the blank first and
 * last lines, so a snippet can be written at the indentation of the code around it and
 * still arrive flush left. Line numbers on screen then match the lines as written.
 */
function code(strings: TemplateStringsArray): string {
  const raw = strings.join('');
  const lines = raw.replace(/^\n/, '').replace(/\n[ \t]*$/, '').split('\n');
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.length - line.trimStart().length);
  const common = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => line.slice(common)).join('\n');
}

export type Language = 'cpp' | 'python';

export type QuestionSpec = {
  readonly id: string;
  readonly index: number;
  readonly language: Language;
  /** What the code is meant to do. Never what it does instead. */
  readonly intent: string;
  readonly code: string;
  /** Clock for the question, in ms. */
  readonly playMs: number;
  /** A warm-up the host declares off the record: nobody is ranked on learning the UI. */
  readonly counts: boolean;
};

const SECOND = 1000;

export const QUESTIONS: readonly QuestionSpec[] = [
  {
    id: 'q0',
    index: 0,
    language: 'cpp',
    intent: 'Add up the n values in a.',
    // Warm-up, and off the record. Three bugs, none of them subtle, so that a team spends
    // this question working out how much detail an answer needs rather than whether they
    // can read C++ at all.
    code: code`
      int arraySum(int a[], int n) {
          int total;
          for (int i = 0; i <= n; i++)
              total += a[i];
          return total;
      }
    `,
    playMs: 120 * SECOND,
    counts: false,
  },
  {
    id: 'q1',
    index: 1,
    language: 'cpp',
    intent: 'The mean of the n values in a.',
    // The one everybody gets. It exists so that every team has points on the board before
    // the first hard question, and because integer division is the single most common way
    // a correct-looking solution is wrong.
    code: code`
      double average(int a[], int n) {
          int total = 0;
          for (int i = 0; i < n; i++)
              total += a[i];
          return total / n;
      }
    `,
    playMs: 120 * SECOND,
    counts: true,
  },
  {
    id: 'q2',
    index: 2,
    language: 'python',
    intent: 'True when the word reads the same forwards and backwards.',
    code: code`
      def is_palindrome(s):
          for i in range(len(s) / 2):
              if s[i] != s[len(s) - i]:
                  return False
          return True
    `,
    playMs: 150 * SECOND,
    counts: true,
  },
  {
    id: 'q3',
    index: 3,
    language: 'cpp',
    intent: 'The largest value in a, and how many times it appears.',
    code: code`
      pair<int, int> highest(vector<int>& a) {
          int mx = 0, cnt = 0;
          for (int i = 0; i <= a.size(); i++) {
              if (a[i] > mx) {
                  mx = a[i];
                  cnt = 1;
              } else if (a[i] = mx) {
                  cnt++;
              }
          }
          return {mx, cnt};
      }
    `,
    playMs: 180 * SECOND,
    counts: true,
  },
  {
    id: 'q4',
    index: 4,
    language: 'cpp',
    intent: 'Answer Q queries, each asking for the sum of a[l..r] inclusive.',
    code: code`
      int n, Q;
      cin >> n >> Q;
      vector<int> a(n);
      for (int i = 0; i < n; i++) cin >> a[i];

      vector<int> pre(n + 1);
      for (int i = 0; i < n; i++)
          pre[i + 1] = pre[i] + a[i];

      while (Q--) {
          int l, r;
          cin >> l >> r;
          cout << pre[r] - pre[l] << endl;
      }
    `,
    playMs: 180 * SECOND,
    counts: true,
  },
  {
    id: 'q5',
    index: 5,
    language: 'cpp',
    intent: 'a is sorted ascending. Is there a pair of entries adding to exactly x?',
    code: code`
      bool hasPair(const vector<int>& a, int x) {
          int i = 0, j = a.size() - 1;
          while (i < j) {
              int s = a[i] + a[j];
              if (s == x) return true;
              if (s < x) j--;
              else i++;
          }
          return false;
      }
    `,
    playMs: 210 * SECOND,
    counts: true,
  },
  {
    id: 'q6',
    index: 6,
    language: 'cpp',
    intent: 'How many vertices are reachable from s, counting s itself.',
    code: code`
      vector<int> adj[N];
      bool seen[N];

      int reach(int s) {
          int count = 1;
          for (int u : adj[s]) {
              if (!seen[u]) {
                  seen[u] = true;
                  count += reach(u);
              }
          }
          return count;
      }
    `,
    playMs: 240 * SECOND,
    counts: true,
  },
  {
    id: 'q7',
    index: 7,
    language: 'cpp',
    intent: 'Can some subset of the n weights in w add up to exactly W?',
    code: code`
      bool subsetSum(const vector<int>& w, int W) {
          vector<bool> can(W + 1, false);
          can[0] = true;
          for (int i = 0; i < (int)w.size(); i++)
              for (int s = w[i]; s <= W; s++)
                  if (can[s - w[i]])
                      can[s] = true;
          return can[W];
      }
    `,
    playMs: 240 * SECOND,
    counts: true,
  },
];

export function questionById(id: string): QuestionSpec | null {
  return QUESTIONS.find((q) => q.id === id) ?? null;
}

/** Longest line in a snippet, which is what decides whether a phone has to pan. */
export function widestLine(snippet: string): number {
  return Math.max(...snippet.split('\n').map((line) => line.length));
}

/** A phone is 390 points wide. These two numbers are the whole reason. */
export const MAX_SNIPPET_LINES = 16;
export const MAX_SNIPPET_COLUMNS = 64;
