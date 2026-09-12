import { Button, MicroLabel, Rule, cn } from '@cpatgt/shared';
import { useEffect, useState } from 'react';
import { MAX_COMPLEXITY_CHARS, MAX_FINDINGS_CHARS } from '../protocol/codes.ts';
import type { TeamAnswer } from '../protocol/types.ts';
import { stashDraft, unstashDraft } from '../transport/client.ts';

/**
 * The two boxes.
 *
 * ## Why two, and why so small
 *
 * One field would have been simpler and would have made the grader guess which half of a
 * sentence was the complexity. Two fields mean the answer arrives already separated, which
 * is why the rubric can be strict about each half independently.
 *
 * The limits do the teaching. Twenty-four characters is `O(n log n)` with room to spare and
 * no room to hedge between two answers. 280 is about two sentences: enough to name three
 * bugs precisely, nowhere near enough to describe the code back to us. A team that cannot
 * fit its third bug has not yet said it crisply enough to be sure they found it.
 *
 * ## Why the draft is local and the answer is not
 *
 * The submitted answer belongs to the team and lives on the server, so four phones agree on
 * what was sent and who sent it. The half-written sentence belongs to the phone — pushing
 * every keystroke to three teammates would be a worse experience than any conflict it could
 * prevent. When someone else submits something different, this says so and offers to load
 * it rather than either clobbering them silently or locking anybody out.
 */

export function AnswerForm({
  questionId,
  answer,
  seat,
  onSubmit,
  disabled = false,
}: {
  questionId: string;
  /** What the team has on the record, if anything. */
  answer: TeamAnswer | null;
  seat: string;
  onSubmit: (complexity: string, findings: string) => Promise<string | null>;
  disabled?: boolean;
}) {
  const [complexity, setComplexity] = useState('');
  const [findings, setFindings] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justSent, setJustSent] = useState(false);

  // A new question is a new sheet of paper. Seeded from whatever this phone was typing
  // before it locked, then from what the team has already submitted.
  useEffect(() => {
    const stashed = unstashDraft(questionId);
    setComplexity(stashed?.complexity ?? '');
    setFindings(stashed?.findings ?? '');
    setError(null);
    setJustSent(false);
  }, [questionId]);

  useEffect(() => {
    stashDraft(questionId, complexity, findings);
  }, [questionId, complexity, findings]);

  const submitted = answer !== null && answer.submittedAt !== null;
  const theirs =
    submitted && (answer.complexity !== complexity || answer.findings !== findings);
  const mine = answer?.submittedBy === seat;

  const send = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const failure = await onSubmit(complexity, findings);
    setBusy(false);
    if (failure !== null) {
      setError(failure);
      return;
    }
    setJustSent(true);
  };

  const empty = complexity.trim().length + findings.trim().length === 0;

  return (
    <div className="flex flex-col gap-5">
      {submitted && (
        <div className="flex flex-col gap-2 border border-hairline-strong bg-ground-raised p-3">
          <div className="flex items-baseline justify-between gap-3">
            <MicroLabel as="h2" className="text-ink">
              On the record
            </MicroLabel>
            <span className="font-mono text-xs text-ink-faint">
              {mine ? 'you' : `phone ${answer.submittedBy}`}
            </span>
          </div>
          <p className="font-mono text-sm text-ink">{answer.complexity || '—'}</p>
          <p className="text-sm text-ink-muted">{answer.findings || '—'}</p>
          {theirs && (
            <Button
              variant="quiet"
              className="mt-1 self-start"
              onClick={() => {
                setComplexity(answer.complexity);
                setFindings(answer.findings);
              }}
            >
              Load it into my boxes
            </Button>
          )}
        </div>
      )}

      <Rule />

      <Field
        label="Time complexity"
        hint="Of the code as written."
        value={complexity}
        max={MAX_COMPLEXITY_CHARS}
      >
        <input
          value={complexity}
          onChange={(event) => setComplexity(event.target.value.slice(0, MAX_COMPLEXITY_CHARS))}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="O(n log n)"
          className="h-12 w-full border border-hairline-strong bg-ground-raised px-3 font-mono text-lg text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none disabled:opacity-50"
        />
      </Field>

      <Field
        label="What&rsquo;s wrong with it"
        hint="One bug per clause. Cite a line number."
        value={findings}
        max={MAX_FINDINGS_CHARS}
      >
        <textarea
          value={findings}
          onChange={(event) => setFindings(event.target.value.slice(0, MAX_FINDINGS_CHARS))}
          disabled={disabled}
          rows={5}
          autoCapitalize="sentences"
          /*
           * The placeholder teaches the shape — line numbers, semicolons, no sentences —
           * and is deliberately written in the register that scores *nothing*. "Overflows"
           * and "off by one" with no object are exactly the category-level remarks the
           * marking scheme refuses, so a team that copies this gets the format right and
           * zero points, which is the lesson in one move. It also means the box on the
           * warm-up question is not quietly printing that question's own answer.
           */
          placeholder="line 4 off by one; line 6 overflows; no guard for n = 0"
          className="w-full resize-none border border-hairline-strong bg-ground-raised p-3 text-base leading-snug text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none disabled:opacity-50"
        />
      </Field>

      {error !== null && <p className="text-sm text-ink">{error}</p>}

      {/* The one ochre element on the screen: this phone's pending action. It sits directly
          under the box rather than pinned to the bottom of the viewport, because a fixed bar
          and the iOS keyboard fight, and the keyboard wins. */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={disabled || busy || empty}
        onClick={() => void send()}
      >
        {submitted ? 'Replace our answer' : 'Submit'}
      </Button>

      <p className="text-xs text-ink-faint">
        {justSent
          ? 'Sent. You can keep changing it — only the last one counts, and nothing is marked until the question closes.'
          : 'Submit as often as you like. Only the last one counts.'}
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  max,
  children,
}: {
  label: string;
  hint: string;
  value: string;
  max: number;
  children: React.ReactNode;
}) {
  const left = max - value.length;
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3">
        <MicroLabel className="text-ink">{label}</MicroLabel>
        {/* Counts down, not up. What is left is the number that changes behaviour. */}
        <span
          className={cn(
            'font-mono text-xs tnum',
            left === 0 ? 'text-accent' : left <= 30 ? 'text-ink-muted' : 'text-ink-faint',
          )}
        >
          {left}
        </span>
      </span>
      {children}
      <span className="text-xs text-ink-faint">{hint}</span>
    </label>
  );
}
