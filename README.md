# cpatgt-interactives

Small, self-contained interactives for the competitive programming club's booth and
outreach. Each one lives in its own folder and shares a single design system.

| Folder    | What it is                                                       |
| --------- | ---------------------------------------------------------------- |
| `shared/` | `@cpatgt/shared` — theme, fonts, primitives, hooks, booth session |
| `nim/`    | Nim against a bot that plays perfectly                           |
| `milk/`   | Farmer John's contaminated bucket, against an adversary          |

## Getting started

```sh
nvm use            # Node 24, pinned in .nvmrc
npm ci             # exact versions from the committed lockfile
npm run dev:nim    # http://localhost:5173
npm run dev:milk   # http://localhost:5174
```

Other scripts, all from the repo root:

```sh
npm test           # vitest across every workspace
npm run typecheck
npm run build      # both interactives -> <name>/dist
npm run preview:nim   # serves nim/dist  on :4173
npm run preview:milk  # serves milk/dist on :4174
```

Ports are pinned per interactive so both can run side by side on one booth machine.

## Nim

Normal-play Nim on three rows: take any number of stones from a single row, and
whoever takes the last stone wins.

**The game is presented as "Stone Game", never as Nim.** Naming it lets a visitor
search the strategy mid-game, which is the whole challenge. The build is checked for
this — `App.test.tsx` asserts the rendered page never contains it, and the folder,
package, and component names stay `nim` because none of them reach a visitor. The bot plays perfectly — it never gives up a won position, and from
a lost one it picks the move that leaves an opponent the fewest correct replies.

Every opening is dealt with a non-zero nim-sum and the visitor moves first, so **the
visitor can always win**. That guarantee is enforced by tests, not by hope:
`nim/src/game/nim.test.ts` checks the nim-sum rule against exhaustive minimax over
every position up to four rows of six, and plays a perfect visitor against the bot
from all nineteen openings.

`OPENINGS` is not a hand-picked list — it is *every* three-row board meeting the
criteria in `positions.ts`, which happens to come to nineteen. Widen the criteria and
re-run the enumeration if you ever want more variety.

- **Mouse** — hover previews the take, one click commits.
- **Touch** — first tap stages the take, the confirm button or a second tap commits.
- **Keyboard** — arrows pick the row and how many, Enter commits, Esc clears.

A hint is always available, and taking one keeps that game off the leaderboard. This
is stated on the button before it is pressed.

### Running it at the booth

```sh
npm ci && npm run build && npm run preview:nim
```

Open the URL, press F11 for fullscreen, and disable the machine's sleep and screensaver.
From there it looks after itself:

- 60s untouched mid-game deals a fresh board;
- 45s untouched after that shows the attract screen with the leaderboard;
- any key, click, or touch starts a new game.

The Discord QR sits in the bottom-right corner of every screen. It is not a link —
a stray click on a booth screen would navigate the game away — so it only works by
scanning. To point it somewhere else, edit `INVITE` in `shared/scripts/make-qr.mjs`
and re-run `node shared/scripts/make-qr.mjs`; that regenerates the committed
component. It needs the `qrencode` binary (`pacman -S qrencode`) and fetches the CC0
Discord glyph from simple-icons, but only at generation time — the app itself ships
the matrix inline and never touches the network.

Verify a regenerated code actually scans before trusting it:

```sh
zbarimg --raw <screenshot.png>   # must print the invite URL
```

**`Ctrl` + `Shift` + `K` clears the leaderboard** after a confirmation prompt. It is
deliberately undiscoverable so visitors do not find it. Nothing else in the UI can
erase the board.

## Milk Test

Farmer John has twenty buckets of milk and one of them is contaminated. A test kit
takes samples from any group of buckets and reports whether the bad one is among
them; each kit works once, and **every kit runs at the same time**, so the whole plan
is committed before a single result comes back.

The visitor starts with one kit and adds as many as they want, up to ten. The grid is
buckets across and kits down, and filling a cell pours a splash of that bucket into
that kit. Drag to fill a run of cells; a tap or click does one.

The board is presented as "Milk Test" and the strategy is never named on screen, for
the same reason nim never says its own name.

### Why five kits

A loading gives every bucket a *signature*: the set of kits it went into. The results
are one signature, and every bucket carrying it is still a suspect. So the visitor
wins exactly when all twenty signatures are distinct — and `k` kits offer only
`2 ** k` signatures. Twenty buckets need five. Four give sixteen, and by pigeonhole
two buckets must collide, which is why four kits cannot work however cleverly they
are arranged.

`buckets.test.ts` enforces this rather than asserting it: every grid built with four
kits is checked to collide, and every distinct grid is checked to leave exactly one
suspect.

### The adversary

Nothing is contaminated when the game starts. What the bucket turns out to be depends
on how well the grid was built:

- **A perfect grid** — every bucket with its own signature — leaves the machine no way
  to punish anyone, so the bucket is drawn at random from all twenty and the visitor
  reads it straight off the results.
- **Any other grid** is answered adversarially. The machine announces whichever
  signature the most buckets share, and when the visitor finally picks one of those
  buckets it says it was a different one. **A guess between two buckets is always
  wrong** — never a coin toss.

Both adversarial choices are drawn at random from everything the machine could
legitimately say: which of the tied-worst signatures it announces, and which of the
remaining suspects it names at the end. Neither draw can hand out luck — tied groups
are the same size by definition, and every remaining suspect is equally a loss for
whoever guessed a different one — so the toss decides *which* bucket it was but never
*whether* the visitor could win. Randomising it matters at a booth: always naming the
lowest would let a queue learn the answer by watching instead of thinking. On a
perfect grid every group is tied at one, and that draw is the random pick above.

### Scoring

The riddle is "how few kits do you need", so the board ranks on **kits first, time
only as a tie-break** — a fast win with nine kits is not the answer. Both are packed
into the single number the shared leaderboard sorts on (`game/score.ts`) and shown as
`5 · 0:12.3`.

There is no hint in this interactive.

## Where the leaderboards live

`localStorage`, in one browser profile, on one machine. Each interactive keeps its
own board under its own key (`cpatgt:leaderboard:nim.v1`, `…:milk.v1`), so they never
collide. They survive reloads and restarts, but they do **not** sync anywhere, a
second booth laptop keeps completely separate boards, and clearing site data wipes
them. That is the direct consequence of having no backend, and is worth knowing
before someone tidies the browser mid-event.

`Ctrl` + `Shift` + `K` clears the board of whichever interactive is on screen.

## Adding an interactive

1. `mkdir <name>` with `src/`, an `index.html`, a `vite.config.ts`, and a `tsconfig.json`
   extending `../tsconfig.base.json` — copy `nim/`'s, they are four lines each.
2. Add `"<name>"` to `workspaces` in the root `package.json` and to `projects` in
   `vitest.config.ts`.
3. Depend on `"@cpatgt/shared": "*"` and start the CSS with:

   ```css
   @import 'tailwindcss';
   @import '@cpatgt/shared/theme.css';
   @import '@cpatgt/shared/base.css';
   @source './';
   @source '../../shared/src';
   ```

   The second `@source` is not optional — shared components live outside the package
   root, so without it every class they use is purged from the production build.

Render `<DiscordCorner />` once at the top level, as `nim/src/App.tsx` does — it is
fixed-position and sits above the attract overlay, so one instance covers every
screen.

4. Call `useBoothSession` and render `AppShell` + `BoothControls` + `BoothAttract` +
   `GameOverPanel`. Between them that is the leaderboard, the attract overlay, the
   help dialog, the idle timers, and the volunteer's clear-the-board shortcut — an
   interactive should only have to write its own game.

Reach for `shared/` before writing anything twice. Nim and Milk Test differ in almost
every respect and still share `AppShell`, `BoothControls`, `ActionBar`, `BoothAttract`,
`GameOverPanel`, `HelpDialog`, `Leaderboard`, `useBoothSession`, `useElapsed`,
`useIdle`, `createLeaderboard` and `checkName`. Where they genuinely differ the shared
piece takes a prop rather than being forked: `GameOverPanel` and `BoothAttract` take a
`format`, a `valueLabel` and a `boardHeading`, which is how one ranks on time and the
other on kits-then-time.

### The design system

`shared/src/theme.css` holds every colour, face, and duration as a token, in both
light and dark. Two rules keep it coherent:

- **The accent means one thing**: the visitor's own pending action. Nothing decorative
  is ever ochre, which is why a staged take reads instantly on a near-monochrome board.
- **Structure comes from hairlines and whitespace**, not shadows, gradients, or fills.

Fonts are self-hosted (Inter Tight and JetBrains Mono, both OFL, latin subset, 75KB
together). Booth venues routinely have no usable network, and a silent fallback to
`system-ui` changes metrics enough to break these layouts.

## Dependency policy

Supply-chain attacks on npm overwhelmingly ship as a freshly published version of a
legitimate package that gets yanked within days. `.npmrc` is set up accordingly:

```
min-release-age=14      # nothing published in the last 14 days is ever installed
ignore-scripts=true     # no install-time script execution
save-exact=true         # no ^ ranges; the lockfile is the truth
```

`min-release-age` needs npm 11.6+, which is why `.nvmrc` pins Node 24. Install with
`npm ci`, never `npm install --force`, and run `npm audit signatures` after changing
dependencies.

The surface is kept deliberately small — **react and react-dom are the only runtime
dependencies**, and the dev toolchain is vite, typescript, tailwind, vitest and types.
No router, no state library, no animation library, no UI kit. If a new dependency
looks necessary, check first whether fifty lines in `shared/` would do instead; that
is where `cn`, `formatDuration`, and the leaderboard store came from.

If `npm ci` ever fails on a missing platform binary, that is `ignore-scripts` doing
its job. Rebuild the one package that needs it (`npm rebuild esbuild`) rather than
turning the flag off.
