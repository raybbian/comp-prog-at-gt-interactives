import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FitMono } from './FitMono.tsx';

/**
 * The numbers here are the ones the projector actually has: the host board gives the URL
 * a 1120px column less 56px of padding either side, and the briefing slide gives it 760px
 * less the same. A domain that overflows those is not a hypothetical — it is the one this
 * is deployed under.
 */
const HOST_COLUMN = 1120 - 112;
const BRIEF_COLUMN = 760 - 112;

/** What the CSS resolves to, in px, for a container of the given width. */
function resolved(html: string, container: number): number {
  const match = /font-size:min\(([^,]+),\s*calc\(100cqw\s*\/\s*([\d.]+)\)\)/.exec(html);
  if (match === null) throw new Error(`no fitted font-size in ${html}`);
  const cap = Number.parseFloat(match[1] as string) * 16;
  return Math.min(cap, container / Number.parseFloat(match[2] as string));
}

/** JetBrains Mono advances 0.6em a glyph, so this is the line's real width. */
const widthOf = (text: string, size: number): number => text.length * 0.6 * size;

describe('FitMono', () => {
  const long = 'telephone.competitiveprogrammingatgt.org';
  const short = 'tel.gt.edu';

  it('keeps a long URL inside the column it is given', () => {
    for (const [column, max] of [
      [HOST_COLUMN, '4rem'],
      [BRIEF_COLUMN, '3.25rem'],
    ] as const) {
      const size = resolved(renderToString(<FitMono text={long} max={max} />), column);
      expect(widthOf(long, size), `${column}px`).toBeLessThanOrEqual(column);
    }
  });

  it('does not blow a short one up past its cap', () => {
    const size = resolved(renderToString(<FitMono text={short} max="4rem" />), HOST_COLUMN);
    expect(size).toBe(64);
  });

  // The old fixed size, for the record: it is what the long domain was overflowing by.
  it('is the fix for a size that was never going to fit', () => {
    expect(widthOf(long, 64)).toBeGreaterThan(HOST_COLUMN);
  });
});
