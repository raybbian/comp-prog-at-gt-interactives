/**
 * The answer key.
 *
 * **This file lives in `worker/` and must never be imported from `src/`.** Vite bundles
 * `src/`; everything in it is readable by a team with devtools open. Keeping the key on
 * the server side of the fence is the one thing standing between this game and a team
 * that reads the bug list out of the JavaScript, and `questions.test.ts` asserts the
 * import never happens.
 *
 * Two things every entry owes the grader, because the grader is only as good as this file
 * is:
 *
 * **A complexity with its tolerances written down.** `O(n log n)`, `n log n` and
 * `O(nlogn)` are the same answer and a regex would only accept one of them, which is a
 * large part of why a language model is doing this job at all. `accept` and `reject` say
 * where the line is, so the line is a decision made here at leisure rather than one made
 * live by a model reading a rubric that did not mention it.
 *
 * **A bug stated as a falsifiable claim.** `summary` is what the team had to say; the
 * grader matches against it, so "the loop runs one past the end" is gradeable and "bad
 * indexing" is not. `detail` is the sentence that goes on the projector afterwards, and it
 * is allowed to teach.
 */

export type BugSpec = {
  /** Stable, and part of the grader's output schema, so it can never invent one. */
  readonly id: string;
  /** The claim a team has to have made. Shown at the reveal. */
  readonly summary: string;
  /** Why it is wrong and what it should be. For the projector. */
  readonly detail: string;
};

export type AnswerSpec = {
  readonly questionId: string;
  /** The canonical form, as it goes on the projector. */
  readonly complexity: string;
  /** One line on why, for the reveal. */
  readonly complexityNote: string;
  /** Phrasings that mean the same thing and must be accepted. */
  readonly accept: readonly string[];
  /** Near misses that must not be accepted, and they are the ones teams will write. */
  readonly reject: readonly string[];
  readonly bugs: readonly BugSpec[];
};

export const ANSWERS: readonly AnswerSpec[] = [
  {
    questionId: 'q0',
    complexity: 'O(n)',
    complexityNote: 'One pass over the array, one addition per element.',
    accept: ['O(n)', 'linear', 'n', 'O(N)', 'Theta(n)'],
    reject: ['O(1)', 'O(n^2)', 'O(log n)'],
    bugs: [
      {
        id: 'q0.uninit',
        summary: 'total is never initialised, so it starts at whatever was on the stack',
        detail:
          'int total; declares the variable without giving it a value. Reading it before assigning is undefined behaviour — write int total = 0.',
      },
      {
        id: 'q0.bounds',
        summary: 'i <= n runs one past the end and reads a[n]',
        detail:
          'The valid indices are 0 through n-1, so the condition has to be i < n. As written the last iteration reads memory the array does not own.',
      },
      {
        id: 'q0.overflow',
        summary: 'the accumulator and return type are int, so the sum overflows',
        detail:
          'Two hundred thousand values of 10^9 come to 2·10^14, far past the 2·10^9 an int holds. total and the return type both have to be long long.',
      },
    ],
  },
  {
    questionId: 'q1',
    complexity: 'O(n)',
    complexityNote: 'One pass, then one division.',
    accept: ['O(n)', 'linear', 'n', 'O(N)'],
    reject: ['O(1)', 'O(n^2)', 'O(log n)'],
    bugs: [
      {
        id: 'q1.intdiv',
        summary: 'total / n is integer division, so the mean is truncated before it is a double',
        detail:
          'Both operands are int, so C++ does an integer divide and only then widens the result. The mean of 5 and 2 comes back as 3, not 3.5. Cast one side: (double)total / n.',
      },
      {
        id: 'q1.overflow',
        summary: 'total is an int and overflows',
        detail:
          'The sum is bounded by n times the largest value, which is well past what an int holds. It has to be a long long — this is the same bug as the last question, and it will keep turning up.',
      },
      {
        id: 'q1.divzero',
        summary: 'nothing guards n == 0',
        detail:
          'An empty array divides by zero. Integer division by zero is undefined behaviour, not an infinity, so this is a crash rather than a NaN.',
      },
    ],
  },
  {
    questionId: 'q2',
    complexity: 'O(n)',
    complexityNote: 'Half a pass over the string, which is still linear in its length.',
    accept: ['O(n)', 'linear', 'O(len(s))', 'O(n/2)', 'n'],
    reject: ['O(1)', 'O(n^2)', 'O(log n)'],
    bugs: [
      {
        id: 'q2.floatdiv',
        summary: 'len(s) / 2 is a float, and range() will not take one',
        detail:
          'In Python 3 the / operator always produces a float, so this raises TypeError before it compares anything. Floor division, len(s) // 2, is what range needs.',
      },
      {
        id: 'q2.mirror',
        summary: 's[len(s) - i] is off by one and indexes past the end',
        detail:
          'The mirror of position i is len(s) - 1 - i. As written the very first comparison asks for s[len(s)], which does not exist.',
      },
    ],
  },
  {
    questionId: 'q3',
    complexity: 'O(n)',
    complexityNote: 'One pass, constant work per element.',
    accept: ['O(n)', 'linear', 'n', 'O(a.size())'],
    reject: ['O(1)', 'O(n^2)', 'O(n log n)'],
    bugs: [
      {
        id: 'q3.assign',
        summary: 'a[i] = mx is an assignment, not a comparison',
        detail:
          'A single = writes mx into the array and then tests the value it wrote, so the branch is taken whenever mx is not zero — and the input is quietly destroyed as it goes. It has to be ==.',
      },
      {
        id: 'q3.bounds',
        summary: 'i <= a.size() reads one past the end',
        detail:
          'The last valid index is a.size() - 1. The comparison also mixes a signed int with an unsigned size_t, which is the warning that would have caught it.',
      },
      {
        id: 'q3.mxzero',
        summary: 'mx starts at 0, so an all-negative array reports 0',
        detail:
          'Zero is not a safe floor for an unknown range of values. Start from a[0] with the count at 1 — and guard the empty case, which then needs an answer of its own.',
      },
    ],
  },
  {
    questionId: 'q4',
    complexity: 'O(n + Q)',
    complexityNote:
      'Linear to build the prefix sums, then constant time per query. Two inputs, so two terms.',
    accept: ['O(n + Q)', 'O(n+q)', 'O(n) preprocessing and O(1) per query', 'linear in n plus Q'],
    reject: ['O(n)', 'O(Q)', 'O(n * Q)', 'O(nQ)', 'O(n log n)'],
    bugs: [
      {
        id: 'q4.inclusive',
        summary: 'the query is inclusive, so it needs pre[r + 1] - pre[l] and drops a[r]',
        detail:
          'pre[i] holds the sum of the first i elements, so the sum of a[l..r] inclusive is pre[r+1] - pre[l]. As written every answer is short by a[r].',
      },
      {
        id: 'q4.pretype',
        summary: 'pre is a vector<int>, so the prefix sums overflow',
        detail:
          'The prefix sums grow to the sum of the whole array. pre has to be vector<long long>; the individual values fitting in an int is not enough.',
      },
      {
        id: 'q4.endl',
        summary: 'endl flushes on every query, which is a time limit on its own',
        detail:
          "endl is '\\n' plus a flush. At 10^5 queries that is 10^5 flushes; use '\\n', and add ios::sync_with_stdio(false) with cin.tie(nullptr).",
      },
    ],
  },
  {
    questionId: 'q5',
    complexity: 'O(n)',
    complexityNote:
      'Each step moves one of the two pointers and they only ever move towards each other, so there are at most n steps. The array arrives sorted, so no sort is charged.',
    accept: ['O(n)', 'linear', 'O(n) two pointers', 'O(len(a))'],
    reject: ['O(n^2)', 'O(n log n)', 'O(log n)'],
    bugs: [
      {
        id: 'q5.swapped',
        summary: 'the two pointer moves are the wrong way round',
        detail:
          'When the sum is too small you need a bigger value, which means i++. This does j--, making the sum smaller still, so it walks away from the answer and misses pairs that are there.',
      },
      {
        id: 'q5.overflow',
        summary: 'a[i] + a[j] is computed in int and overflows',
        detail:
          'Two values near 2^31 add to something an int cannot hold, and signed overflow is undefined. Make s a long long, or compare a[i] against x - a[j].',
      },
      {
        id: 'q5.empty',
        summary: 'a.size() - 1 on an empty vector is a huge unsigned value',
        detail:
          'size() is unsigned, so 0 - 1 wraps to SIZE_MAX before it is narrowed into an int. Guard the empty case, and keep the index type consistent with size().',
      },
    ],
  },
  {
    questionId: 'q6',
    complexity: 'O(n + m)',
    complexityNote:
      'Every vertex is entered once and every adjacency list is walked once, so it is vertices plus edges — not the product.',
    accept: ['O(n + m)', 'O(V + E)', 'O(n + e)', 'O(V+E)', 'linear in vertices plus edges'],
    reject: ['O(n)', 'O(m)', 'O(n^2)', 'O(n * m)', 'O(nm)'],
    bugs: [
      {
        id: 'q6.root',
        summary: 'seen[s] is never set, so an edge back to s counts it twice',
        detail:
          'The starting vertex is the one vertex nothing marks. Any neighbour with an edge back to s finds !seen[s] true and walks into it again. Mark the root before the loop.',
      },
      {
        id: 'q6.stack',
        summary: 'the recursion is as deep as the graph is long and overflows the stack',
        detail:
          'A path of 2·10^5 vertices is 2·10^5 nested calls. The usual 1–8 MB stack does not hold that: use an explicit stack, or raise the limit.',
      },
      {
        id: 'q6.reset',
        summary: 'seen is a global that is never cleared between calls',
        detail:
          "The second call in a multi-test-case loop sees the first run's marks and returns a smaller answer. Clear it per test — but clear only the vertices used, or the clearing becomes the bottleneck.",
      },
    ],
  },
  {
    questionId: 'q7',
    complexity: 'O(n * W)',
    complexityNote:
      'n passes over a table of W+1 entries. That is linear in the *value* of W, not in the size of its input — pseudo-polynomial, which is why a large W is fatal and a large n is not.',
    accept: ['O(n * W)', 'O(nW)', 'O(n·W)', 'O(n W)', 'pseudo-polynomial O(nW)'],
    reject: ['O(n)', 'O(W)', 'O(n^2)', 'O(2^n)', 'O(n log W)'],
    bugs: [
      {
        id: 'q7.direction',
        summary: 'the inner loop must run downwards, or one weight gets reused',
        detail:
          'Going up, can[s - w[i]] may already have been set by w[i] itself in this same pass, so the code answers "using each weight as often as you like". Loop s from W down to w[i].',
      },
      {
        id: 'q7.memory',
        summary: 'the table is W+1 entries, so a large W cannot be allocated at all',
        detail:
          'The table is indexed by the target. W up to 10^9 is a gigabyte-scale allocation before any work happens — the cost is driven by the value of W, not by how many weights there are.',
      },
      {
        id: 'q7.vectorbool',
        summary: 'vector<bool> is a bit-packed proxy, not a container of bools',
        detail:
          'Every read and write goes through bit masking, and it does not behave like a normal vector. vector<char>, or a bitset with shifts, is what to reach for in a hot DP loop.',
      },
    ],
  },
];

export function answerFor(questionId: string): AnswerSpec | null {
  return ANSWERS.find((a) => a.questionId === questionId) ?? null;
}

export function bugIdsFor(questionId: string): readonly string[] {
  return answerFor(questionId)?.bugs.map((b) => b.id) ?? [];
}
