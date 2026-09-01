import { cn } from '@cpatgt/shared';

/**
 * A monospace line sized to the width it actually has.
 *
 * The join URL is whatever domain the meeting is deployed under, and the gap between
 * `tel.gt.edu` and `telephone.competitiveprogrammingatgt.org` is the gap between
 * comfortable and off the side of the projector. A fixed type size can only be right for
 * one of them.
 *
 * Monospace makes this arithmetic rather than measurement: every glyph in JetBrains Mono
 * is 0.6em wide, so N characters occupy 0.6N em and the size that fits is the container
 * divided by that. Sized in `cqw` against a container rather than in pixels, so it stays
 * right if the column around it is ever rebalanced — the 1920-wide board and the briefing
 * slide have different room for it and neither has to be told the number.
 */
const ADVANCE = 0.62;

export function FitMono({
  text,
  max,
  className,
}: {
  text: string;
  /** The size to use when the text is short enough not to need shrinking. */
  max: string;
  className?: string;
}) {
  const wide = (Math.max(1, text.length) * ADVANCE).toFixed(2);
  return (
    <div style={{ containerType: 'inline-size' }}>
      <p
        className={cn('whitespace-nowrap font-mono leading-none tnum', className)}
        style={{ fontSize: `min(${max}, calc(100cqw / ${wide}))` }}
      >
        {text}
      </p>
    </div>
  );
}
