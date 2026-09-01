import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SnakeGrid } from './SnakeGrid.tsx';

/**
 * Nine steps of one ramp are not nine things the eye can name. The sender has to read a
 * level off a phone and say it out loud in digits, so the digit is written in the cell —
 * the colour is the index, not the message.
 */
describe('SnakeGrid numbers', () => {
  const size = { w: 4, h: 1 };
  /** Levels 1, 2 and 3 along a three-cell snake, with the last cell empty. */
  const grid = '1230';

  const digits = (html: string): string =>
    [...html.matchAll(/>(\d)<\/span>/g)].map((m) => m[1]).join('');

  it('writes the level into every coloured cell', () => {
    expect(digits(renderToString(<SnakeGrid size={size} grid={grid} levels={9} numbers />))).toBe(
      '123',
    );
  });

  // The head marker sits in the middle of its cell; the level has to survive that, or the
  // one cell a pair count from is the one whose colour cannot be read.
  it('still writes the level on the cell carrying the head marker', () => {
    const html = renderToString(
      <SnakeGrid size={size} grid={grid} levels={9} numbers head={0} />,
    );
    expect(digits(html)).toBe('123');
    expect(html).toContain('rounded-full');
  });

  it('leaves the grid bare unless asked', () => {
    expect(digits(renderToString(<SnakeGrid size={size} grid={grid} levels={9} />))).toBe('');
  });

  // On a black-and-white round there are no shades to tell apart, and a grid of 1s is
  // noise over the only thing that matters, which is the shape.
  it('writes nothing on a monochrome round', () => {
    expect(
      digits(renderToString(<SnakeGrid size={size} grid="1110" levels={1} numbers />)),
    ).toBe('');
  });
});
