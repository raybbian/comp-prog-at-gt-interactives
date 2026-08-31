// Runs the two halves of Telephone together: Vite on 5176 for the client, and
// `wrangler dev` on 8787 for the worker and its Durable Object, with `/api` proxied
// across so both live on one origin exactly as they do in production.
//
// Forty lines rather than a dependency, which is the trade this repo's dependency policy
// asks for. `&` would have been shorter and is POSIX-only, which is no good on the
// Windows machines this gets run from; `dev:web` and `dev:api` remain as the
// two-terminal escape hatch when you want clean output from one of them.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Resolve a package's own JS entry point and run it under this Node.
 *
 * Not `npx`, and not the `node_modules/.bin` shims: on Windows those are `.cmd` files,
 * which Node refuses to spawn without a shell (it throws EINVAL), and going through a
 * shell means `kill` reaches the shell rather than the process — which is how you end up
 * with an orphaned workerd still holding port 8787 and its sqlite files.
 */
function binOf(name, binName = name) {
  const pkgDir = join(root, 'node_modules', name);
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const entry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[binName];
  return join(pkgDir, entry);
}

const parts = [
  { name: 'web', tint: '[36m', script: binOf('vite'), args: ['--host'] },
  { name: 'api', tint: '[35m', script: binOf('wrangler'), args: ['dev', '--port', '8787'] },
];

const children = parts.map(({ name, tint, script, args }) => {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: join(root, 'telephone'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tag = `${tint}${name.padEnd(3)}[0m │ `;

  for (const stream of [child.stdout, child.stderr]) {
    let rest = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(`${tag}${line}\n`);
    });
  }

  child.on('exit', (code) => {
    process.stdout.write(`${tag}exited with ${code}\n`);
    stop(code ?? 0);
  });
  return child;
});

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  // Give workerd a moment to let go of its sqlite files; killing the process tree hard
  // leaves them locked on Windows and the next `wrangler dev` fails to start.
  setTimeout(() => process.exit(code), 400);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
