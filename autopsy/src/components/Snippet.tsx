import { cn } from '@cpatgt/shared';

/**
 * The code, with a line-number gutter and no syntax highlighting.
 *
 * The gutter is not decoration and not a nicety — it is the vocabulary the answer is going
 * to be written in. A team gets 280 characters, and "line 4 reads a[n]" costs eighteen of
 * them where "the loop condition in the for statement" costs forty and says less. Numbering
 * the lines is what makes a terse answer possible, which is what makes the character limit
 * fair.
 *
 * Nothing here is coloured. See `app.css` for why: highlighting tells the reader where to
 * look, and deciding that is the exercise.
 *
 * `size` is a token rather than a number because this renders in two places that could not
 * be further apart — a 390-point phone and a lecture-hall projector — and the gutter width,
 * leading and type size all have to move together.
 */

export type SnippetSize = 'phone' | 'room';

const TYPE: Record<SnippetSize, string> = {
  // 13px, which is the floor at which a lowercase l and a 1 are still distinguishable in
  // JetBrains Mono at arm's length. Below that, reading code becomes guessing at it.
  phone: 'text-[0.8125rem] leading-[1.55]',
  room: 'text-[1.625rem] leading-[1.45]',
};

const GUTTER: Record<SnippetSize, string> = {
  phone: 'w-6 pr-2',
  room: 'w-14 pr-5',
};

export function Snippet({
  code,
  size = 'phone',
  className,
}: {
  code: string;
  size?: SnippetSize;
  className?: string;
}) {
  const lines = code.split('\n');

  return (
    // `overflow-x-auto` on the frame rather than wrapping the lines: a wrapped line of code
    // changes which line number a statement appears on, and the line numbers are what the
    // answer will cite.
    <div
      className={cn(
        'snippet overflow-x-auto border border-hairline bg-ground-raised font-mono',
        TYPE[size],
        className,
      )}
    >
      <ol className={cn(size === 'phone' ? 'py-2' : 'py-6')}>
        {lines.map((line, i) => (
          <li
            key={i}
            className={cn(
              'snippet-line flex',
              size === 'phone' ? 'px-3' : 'px-10',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('shrink-0 select-none text-right tnum text-ink-faint', GUTTER[size])}
            >
              {i + 1}
            </span>
            <code className="text-ink">{line === '' ? ' ' : line}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
