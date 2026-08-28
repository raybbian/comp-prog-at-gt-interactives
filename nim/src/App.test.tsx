import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

/**
 * A server render is not a substitute for playing the thing, but it does exercise
 * the whole import graph and the first paint, which is where a bad hook order or a
 * circular import shows up. It also proves the app survives an environment with no
 * localStorage and no matchMedia, which is what a locked-down browser looks like.
 */
describe('App', () => {
  it('renders the attract screen without a DOM, storage, or matchMedia', () => {
    expect(typeof localStorage).toBe('undefined');

    const html = renderToString(<App />);

    expect(html).toContain('Stone Game');
    // The game's real name would let a visitor look the strategy up mid-game.
    expect(html).not.toContain('Nim<');
    expect(html).toContain('Competitive Programming at GT');
    expect(html).toContain('Nobody has beaten it yet.');
    expect(html).toContain('Press any key to play');
    expect(html).toContain('discord.gg/5X7UVThEhJ');
  });
});
