import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './protocol/questions.ts';

/**
 * The fence between the client and the answer key.
 *
 * Vite bundles `src/`. If anything under it reached `worker/answers.ts`, the correct
 * complexity and every bug summary would ship inside the JavaScript a team can open in
 * devtools, and nobody would find out until a student mentioned it afterwards. So the key
 * lives on the far side of a directory boundary, and this is the test that the boundary
 * holds.
 *
 * It sits here rather than next to the question table because `tsconfig.worker.json` also
 * typechecks `src/protocol` — under `lib: ES2023` and workers types, with no `import.meta.glob`
 * — and that separation is worth more than the tidiness of keeping the test beside the table.
 */
describe('the answer key stays on the server', () => {
  /**
   * Every client source file, as text. `import.meta.glob` rather than `node:fs` because this
   * repo carries no `@types/node` — deliberately, since the browser half and the worker half
   * are typechecked under different libs and neither should see Node's globals. Vite resolves
   * this at transform time, so it is also exactly the set of files that end up in the bundle.
   */
  const sources = import.meta.glob<string>('./**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('scans a plausible number of files, so a broken glob cannot pass silently', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });

  it('is never imported from anything under src/', () => {
    const offenders = Object.entries(sources)
      // Any reach into the worker directory at all, not just answers.ts: the worker is where
      // every server-only thing in this game lives.
      .filter(
        ([, text]) =>
          /from\s+['"][^'"]*worker\//.test(text) || /import\(['"][^'"]*worker\//.test(text),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('is not reachable through the question table either', () => {
    const text = sources['./protocol/questions.ts'];
    expect(text).toBeTypeOf('string');
    // Prose about the answer key is fine and wanted; a line of code that reaches it is not.
    const stripped = (text ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/answers/i);

    // And the table itself carries no answer-shaped field.
    for (const question of QUESTIONS) {
      expect(Object.keys(question).sort()).toEqual(
        ['code', 'counts', 'id', 'index', 'intent', 'language', 'playMs'].sort(),
      );
    }
  });
});
