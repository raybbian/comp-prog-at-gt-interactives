import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

/**
 * A server render is not a substitute for looking at the thing on a TV, but it does
 * exercise the whole import graph and the first paint, and it proves the poster
 * survives an environment with no window and no matchMedia — which is also what the
 * first frame looks like before the fit-to-screen scale is applied.
 */
describe('App', () => {
  it('renders every band without a DOM or matchMedia', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Competitive Programming');
    expect(html).toContain('@ Georgia Tech');
    expect(html).toContain('competitiveprogrammingatgt.com');
    expect(html).toContain('What we do');
    expect(html).toContain('Weekly practices');
    expect(html).toContain('Lectures &amp; workshops');
    expect(html).toContain('Georgia Tech at the ICPC');
    expect(html).toContain('Where members end up');
    expect(html).toContain('discord.gg/5X7UVThEhJ');
  });

  it('shows the command line complete on the first frame', () => {
    // The typewriter starts full and only begins cycling after the first hold, so a
    // visitor walking past a freshly loaded screen never catches it mid-word.
    expect(renderToString(<App />)).toContain('$ ./join --club competitive-programming');
  });
});
