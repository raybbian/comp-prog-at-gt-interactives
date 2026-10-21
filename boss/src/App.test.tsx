import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { HealthBar } from './components/HealthBar';
import { HitBar } from './components/HitBar';
import { HitPad } from './components/HitPad';
import { Verdict } from './components/Verdict';

const noop = () => undefined;

/**
 * A server render exercises the whole import graph and the first paint, which is where
 * a bad hook order or a circular import shows up, and proves the app survives an
 * environment with no DOM and no matchMedia.
 */
describe('App', () => {
  it('renders the level picker without a DOM or matchMedia', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Boss Fight');
    expect(html).toContain('Easy');
    expect(html).toContain('Medium');
    expect(html).toContain('Hard');
    expect(html).toContain('Competitive Programming at GT');
  });

  it('renders the game screen: the forbidden key is struck out and the staged key is pressed', () => {
    const pad = renderToString(
      <HitPad m={7} forbidden={3} staged={5} disabled={false} onTap={noop} onPreview={noop} />,
    );
    expect(pad).toContain('aria-label="3, not allowed"');
    expect(pad).toContain('disabled=""');
    expect(pad).toContain('aria-pressed="true"');
    expect(pad.match(/<button/g)?.length).toBe(7);

    const bar = renderToString(
      <HitBar turnLabel="Your turn" detail="Bot hit 3." staged={5} canCommit onCommit={noop} />,
    );
    expect(bar).toContain('Hit 5');

    const health = renderToString(
      <HealthBar opening={32} health={24} lastHit={{ by: 'bot', hit: 3 }} />,
    );
    expect(health).toContain('aria-valuenow="24"');
    expect(health).toContain('width:75%');
  });

  it('renders both verdicts', () => {
    const history = [
      { by: 'you' as const, hit: 4 },
      { by: 'bot' as const, hit: 2 },
      { by: 'you' as const, hit: 6 },
    ];
    const won = renderToString(
      <Verdict won history={history} elapsedMs={12_300} onPlayAgain={noop} onChangeLevel={noop} />,
    );
    expect(won).toContain('You win');
    expect(won).toContain('2 hits');
    const lost = renderToString(
      <Verdict won={false} history={history} elapsedMs={12_300} onPlayAgain={noop} onChangeLevel={noop} />,
    );
    expect(lost).toContain('Bot wins');
    expect(lost).toContain('better hit');
  });

  it('never names the problem it is taken from', () => {
    // The real name is a search term, and the editorial is one search away.
    const html = renderToString(<App />).toLowerCase();
    expect(html).not.toContain('smawk');
    expect(html).not.toContain('swerc');
    expect(html).not.toContain('hyper');
  });
});
