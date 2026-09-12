import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { Briefing } from './routes/Briefing.tsx';
import { QUESTIONS } from './protocol/questions.ts';

/**
 * A server render is not a substitute for playing the thing, but it exercises the whole
 * import graph and the first paint, which is where a bad hook order or a circular import
 * shows up. It also proves the app survives an environment with no localStorage, no
 * matchMedia and no EventSource — which is what a locked-down phone browser looks like.
 */
describe('App', () => {
  it('renders without a DOM or an event stream', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Debug Blitz');
    expect(html).toContain('Competitive Programming at GT');
  });

  it('renders the briefing slide with a worked example', () => {
    const html = renderToString(<Briefing joinUrl="https://example.test" />);
    expect(html).toContain('Debug Blitz');
    expect(html).toContain('example.test');
    // The example on the slide is the warm-up question itself, which is off the record —
    // so showing it gives nothing away and the first question is one the room has seen.
    const warmUp = QUESTIONS[0];
    if (warmUp === undefined) throw new Error('no warm-up question');
    expect(html).toContain('arraySum');
    expect(warmUp.counts).toBe(false);
  });

  /**
   * The client bundle must not contain the answer key. `questions.test.ts` enforces that at
   * the import level; this is the same check from the other end — nothing a rendered screen
   * can reach names a bug.
   */
  it('renders no part of the answer key', () => {
    const html = [
      renderToString(<App />),
      renderToString(<Briefing joinUrl="https://example.test" />),
    ].join(' ');

    for (const tell of ['q0.uninit', 'q1.intdiv', 'pseudo-polynomial', 'bit-packed proxy']) {
      expect(html, tell).not.toContain(tell);
    }
  });
});
