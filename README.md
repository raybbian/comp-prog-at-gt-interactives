# cpatgt-interactives

Small, self-contained interactives for the competitive programming club's booth and
outreach. Each one lives in its own folder and shares a single design system.

| Folder    | What it is                                                       |
| --------- | ---------------------------------------------------------------- |
| `shared/` | `@cpatgt/shared` — theme, fonts, primitives, hooks, booth session |
| `nim/`    | Nim against a bot that plays perfectly                           |
| `milk/`   | Farmer John's contaminated bucket, against an adversary          |
| `telephone/` | Two phones, eight digits a message, one picture to get across |

## Getting started

```sh
nvm use            # Node 24, pinned in .nvmrc
npm ci             # exact versions from the committed lockfile
npm run dev:nim    # http://localhost:5173
npm run dev:milk   # http://localhost:5174
npm run dev:poster # http://localhost:5175
npm run dev:telephone # http://localhost:5176 — client and worker together
```

Other scripts, all from the repo root:

```sh
npm test           # vitest across every workspace
npm run typecheck
npm run build      # both interactives -> <name>/dist
npm run preview:nim    # serves nim/dist    on :4173
npm run preview:milk   # serves milk/dist   on :4174
npm run preview:poster # serves poster/dist on :4175
npm run preview:telephone # serves telephone/dist on :4176 (client only)
```

Ports are pinned per folder so they can all run side by side on one booth machine.

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

- 120s untouched mid-game deals a fresh board;
- 90s untouched after that shows the attract screen with the leaderboard;
- any key, click, or touch starts a new game.

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

## Poster

Not an interactive — a single 16:9 screen about the club, for a TV that nobody is
going to touch. It answers "what is this club" for the queue and for anyone walking
past the table, and carries the Discord QR for whoever wants in.

The QR lives only here — the game screens deliberately carry none, so a visitor
playing one is not being sold something in the corner of it, and there is exactly one
thing at the booth to point a phone at. It is not a link — a stray click on a booth
screen would navigate the page away — so it only works by scanning. To point it somewhere else, edit `INVITE` in
`shared/scripts/make-qr.mjs` and re-run `node shared/scripts/make-qr.mjs`; that
regenerates the committed component. It needs the `qrencode` binary
(`pacman -S qrencode`) and fetches the CC0 Discord glyph from simple-icons, but only at
generation time — the app itself ships the matrix inline and never touches the network.

Verify a regenerated code actually scans before trusting it:

```sh
zbarimg --raw <screenshot.png>   # must print the invite URL
```

**Every word and image on it comes from competitiveprogrammingatgt.com.** Nothing is
written or drawn for the poster. `src/content.ts` is the whole of the copy, and each
block in it names the file in the website repo it was transcribed from, so a claim on
a booth TV can be traced back to the page that already makes it in public. The
photography is imported by script rather than by hand:

```sh
node poster/scripts/import-assets.mjs [path-to-comp-prog-at-gt]
```

which resizes the site's photos for a booth screen and copies the sponsor wordmarks
across. It defaults to a sibling `../comp-prog-at-gt` checkout and needs ImageMagick 7.
When the website's art or copy changes, re-run it and re-transcribe — do not edit
prose or drop images into `src/assets/` directly.

### Running it at the booth

```sh
npm ci && npm run build && npm run preview:poster
```

Open the URL and press F11. There is nothing else to do: the page has no state, no
timers to expire and no input to handle, so it can be left up for the whole event.
Disable the machine's sleep and screensaver as usual.

### One canvas, scaled

The poster is composed once at exactly 1920x1080 and then scaled as a whole to fit
whatever panel it lands on, letterboxing the leftover axis. Nothing reflows, so a
1080p booth TV, a 4K lobby screen and a laptop preview all show the same composition
rather than three different ones. `useFitScale` computes the factor and `App.tsx`
applies it across two boxes — a transform does not change an element's layout size,
so the outer box carries the *scaled* dimensions and the inner one is transformed
inside it. Centring a 1920-wide box on a narrower screen clamps it to the left edge
and clips the right, which is the bug that shape avoids.

### What moves

A TV runs for hours, so the motion has to be worth looking at twice and never
distracting:

- the command line types itself out, holds, erases and repeats;
- the three photographs drift slowly, each starting at a different point in the cycle;
- the bands rise in once, in reading order, when the page is first put up.

Two rules the layout depends on. The command line sits in a **fixed-height row** —
its text span collapses to nothing at the bottom of the erase, and without that height
the entire column below would jump up with it. And the photographs drift inside
`overflow-hidden` frames, so nothing they do can move anything else. `prefers-reduced-motion`
turns all of it off, delays included, and the command line is left complete.

### The accent

The interactives spend ochre on the visitor's own pending action. A poster has no
visitor action except one — joining — so the accent appears on the `./join` command
line and the Discord block, and nowhere else. Everything else is ink, hairlines and
whitespace.

The sponsor wordmarks are the exception to the theme: they are the companies' own
artwork, drawn in their own dark inks, so they sit on a fixed light tile in both light
and dark mode. The website does the same thing for the same reason, as does the
Discord QR, which plenty of scanners will refuse if it is inverted.

## Telephone

A game for a room, not a booth. Two people to a team, a phone each, and they have to
split up: one of them is shown a picture and the other has to reproduce it, using
**messages of at most eight digits, 0 through 9, and nothing else**.

That one restriction is the whole thing. You cannot say "row three is black" — you have
to agree, in advance, on what a digit is going to mean. Everything the evening is
actually about follows from teams discovering that their first idea costs five messages
and their second costs two.

**The game never names its own technique**, for the same reason Nim is only ever called
the Stone Game: a name on screen is a search term, and the search hands over the answer.
`App.test.tsx` enforces it by rendering every screen and asserting the words never appear.
The rounds are numbered and nothing more.

### The snakes

Every picture is a *snake*: one unbroken line of cells that never touches itself. Formally
it is an induced path — two body cells are adjacent only when they are adjacent along the
snake — and that rule earns its place three times over. It makes a picture you can trace
by eye without ambiguity; it makes the traversal order recoverable from the cells alone,
which is what lets a round hand over a shape without also handing over where it starts;
and it lets the receiver's editor refuse to draw anything illegal, so a wrong drawing is
not merely wrong, it is unreachable.

`protocol/paths.ts` holds the one predicate all three depend on, and `generate.test.ts`
checks every round's generator against it over sixty seeds.

### The rounds

| # | Grid | Snake | Par | What the gap is about |
| - | ---- | ----- | --- | --------------------- |
| 0 | 6x6   | a straight line, every cell a different colour | 2 | nothing — warm-up, and off the record |
| 1 | 8x8   | one colour, four straight runs, three turns | 2 | say the turns, not the cells |
| 2 | 10x10 | 30 cells in six colour blocks, shape given | 2 | count the blocks, do not list the cells |
| 3 | 10x10 | 30 cells, every step one level up or down, shape given | 2 | it is a string of bits — pack them |
| 4 | 8x8   | one colour, 24 cells, turning constantly | 3 | the walk stops paying — send the board |
| 5 | 8x8   | colour blocks and turns, one message in five lost | 6 | say it twice, or number them and ask |

**Par is on screen at the reveal and nowhere else.** During the round it would tell a team
when to stop thinking; on the results screen afterwards it is the only way a pair who sent
thirty numbers learn that two were enough. Beside it sits the fewest messages any team in
the room solved it in, which is the number that actually stings.

**The first two rounds teach the two halves of the vocabulary, one at a time.** Round 0 is
a straight line, so there is no shape to describe and the colours are the whole message —
and every cell is a different colour, so a pair cannot get lucky and skip the only thing
the round is for. Round 1 is its mirror: one colour, so the shape is the whole message,
with few enough turns that "four right, then three down" is sayable before anyone has been
clever. Meeting either of those for the first time with a clock running and a partner
waiting is the wrong moment, which is why they come first and why round 0 does not count.
Round 0 is also the window in which stragglers are still joining.

**The last four are each a different reason the obvious encoding is not the good one.**
Rounds 2 and 3 both hand over the shape, so the colours are the entire puzzle, and they are
the same thirty cells on the same board — what differs is the structure inside them. In
round 2 the colours arrive in long blocks, so counting blocks beats listing cells. In round
3 every step is exactly one level up or down, so the whole sequence is a start value and
twenty-nine bits: a pair who see that write nine digits where the pair beside them wrote
thirty numbers. Round 4 takes colour away entirely and turns constantly, so describing the
walk stops paying and the board itself — sixty-four cells, exactly eight messages of eight
binary digits — becomes the cheaper thing to send, by the packing trick they just learned.

Those four are the lesson that generalises: the same picture, on the same grid, wants a
different encoding depending on what is inside it. There is no universal answer, you have
to look at the source.

No board is wider than ten cells, which is the other thing round sizes are chosen for: at
ten across, a cell is about 34 points on a phone, and every grid in the game stays
comfortably tappable without anyone pinching to zoom.

Round 5 is the only round with a lossy channel, and that placement is deliberate. A lost
message in a *sequential* encoding desynchronises everything after it and the receiver
cannot know, so dropping messages on rounds 2 through 4 would punish the cleverest teams
hardest. It is also
**additive only** — solving it can win a team a place, its message count cannot cost them
one — because every team loses the same *number* of messages but not the same ones. Flip
`additiveOnly` in `protocol/rounds.ts` to put it on the board with the rest.

Which messages get dropped is a pure function of `(seed, team, direction, ordinal)` with
no stored state, so a replay agrees with the live verdict and a test can assert it. It is
a block quota rather than a coin per message: every team loses exactly one in five, and
only *which* ones differs. A coin would hand one team three losses and another nine over
the same twenty messages, and a team already having a bad round does not need variance on
top.

### Scoring, and why there is no accuracy percentage

A submission is right or it is not. Ranking is **rounds solved, then messages spent, then
time** — messages ahead of the clock, because messages are the point and the clock is a
cutoff.

An accuracy percentage was the obvious alternative and it is worse in two ways. It would
be a gradient to climb: submit, nudge one cell, watch the number move. And the partial
credit it buys is not needed, because **both halves of a team can read the full log of
what they sent and what arrived**. "I sent 4 7 1" against "I got 4 7 4" is a debuggable
conversation; "you scored 61%" is not. That is what makes exact-match fair here rather
than harsh — every failure is diagnosable without either partner seeing the other's
screen. On the lossy round, holding the two logs side by side *is* the exercise.

Submitting is therefore free and unlimited, and only the last one counts. One bit of "not
yet" gives no purchase on a thirty-six bit space, so there is nothing to protect and no
reason to make anyone live with a typo at 4:58.

### What the server will not tell you

Two invariants, and both are types rather than filters, so breaking one is a compile
error rather than something a review has to catch:

- **`ReceiverView` has no `target` field.** A receiver with devtools open reads every byte
  the server sends them; if the answer were anywhere in the payload the game would be
  over, and nobody would find out until a student mentioned it afterwards.
- **No view either player can read carries `delivered`.** On the lossy round the sender
  genuinely cannot tell a message that arrived from one that did not, and that ambiguity
  is the lesson.

`worker/game.test.ts` stringifies both views and asserts the answer is not in there, for
every round, in case a future field smuggles it out.

### Running it

```sh
npm run dev:telephone
```

That starts Vite on 5176 and `wrangler dev` on 8787 together, with `/api` proxied across.
Three screens, all on one origin:

| Route      | Who                                                       |
| ---------- | --------------------------------------------------------- |
| `#/`       | the phones — which half you get is decided by the server   |
| `#/host`   | the projector: the room code, standings, clock, controls   |
| `#/brief`  | the projector before the game: join URL, rules, samples    |

Routing is on the hash, not the path. Every workspace here builds with `base: './'`, so a
visit to `/host/` would resolve `./assets/index-abc.js` against `/host/` and the page
would fail to load its own JavaScript.

**The host screen is driven from the keyboard**, like a slide deck — a host clicking
buttons means the whole room watching someone hunt for a cursor.

| Key | |
| --- | --- |
| `→` / `←` | next / previous stage: brief, play, reveal, next round |
| `Space` | pause and resume the clock |
| `+` / `−` | add or take 30 seconds |
| `Ctrl` `Shift` `K` | reset the whole event, behind a confirmation |

**Opening `#/host` opens a meeting**, and mints the six-digit room code the board then
puts on the wall. Opening it a second time opens a second meeting with a second code, the
way Kahoot does — nothing tries to dedupe them and nothing has to, because the room can
only join the code it can see. The code is remembered per *tab*, so reloading the board or
closing the laptop lid comes back to the same meeting, and it is written into the address
bar as `#/host?r=<code>` so a tab closed by accident can be reopened.

There is no host key. The board is unauthenticated, because the only thing a key ever
bought was stopping someone in the room from opening a URL they were not given — a social
problem that cost a Cloudflare secret which had to be set before the one evening it
mattered. What made that safe to drop is that the board has nothing on it worth stealing:
`HostTeamRow` carries no join code at all. It never needed one. A code is read off the
phone of whoever made the team by the partner sitting beside them, and that phone puts it
back on screen by itself the moment a seat falls empty — so the recovery case the board
might have covered is already covered where the code belongs.

`npm run preview:telephone` serves only the built client, with no API behind it. It is
useful for looking at a screen, not for playing — use `npm run dev:telephone` for that.

### Where Telephone's state lives

Not `localStorage`. One **Durable Object** per meeting: a single-threaded, globally unique
actor holding every team, message and round in memory, with durable storage underneath.
That is the "one long-running process" model the game needs, without a laptop under the
projector that has to be kept awake — and because it is single-threaded, two phones on the
same team can never interleave halfway through a mutation.

Teams are stored one key at a time rather than as one blob; a Durable Object value is
capped well below what twenty teams' message logs come to by the end of an evening.

The object is named after its room code, and it claims that code itself: minting picks a
candidate, asks the object that name would address whether it is already open, and tries
again if it is. `idFromName` is deterministic, so that question *is* "is this code free",
and the object answers it on its own single thread — which is what makes two hosts minting
in the same second safe without a registry, a lock, or a second place for the truth to
live. An object that has never been opened refuses every route but `/__open`, so a
mistyped code is a 404 rather than an empty meeting somebody is alone in.

### Sessions, and why they travel twice

A session is set as an `HttpOnly` cookie *and* sent as an `x-tel-session` header on every
request. That is not belt-and-braces for its own sake — each covers a case the other
cannot. `EventSource` cannot set a header, so the stream needs the cookie; and a phone
will refuse a `Secure` cookie over plain HTTP, which is exactly what
`http://<laptop-ip>:5176` is when you are testing on the LAN. (`localhost` is exempt from
that rule, which is why it only ever broke on a real phone.) iOS also evicts cookies on
its own schedule, so `localStorage` holds the durable copy.

The cookie is marked `Secure` only when the request arrived over HTTPS, so production keeps
the property and local testing works.

If the server ever refuses a session outright, the client says so and offers the way back
in. It does not sit on a spinner: the join code is stable across restarts and redeploys, so
recovering is always "type your code again".

### The event stream

Server-sent events, with polling underneath. The mental model that keeps it honest:
**`GET /api/view` is how a client learns the state, and the stream is a latency
optimisation that lets it skip a poll.** Both return the identical payload — a full
snapshot of everything that session may see, never a delta — so there is one code path to
test, a dropped event cannot desync anyone, and a reconnect needs no replay buffer because
the first event after it *is* the truth.

It is SSE rather than WebSockets for one reason: `EventSource` reconnects by itself and a
WebSocket does not, and the failure this design actually has to survive is forty phones
locking their screens. The client polls every twenty seconds while the stream is healthy
and every three while it is not, resyncs whenever the page comes back to the foreground,
and shows a small dot in the top rail so a volunteer can tell "streaming" from "polling,
and fine" without guessing.

### On a phone

Everything except the projector is used one-handed, standing, by someone talking to a
partner across the room. So: no system keyboard anywhere except the one team-name field
(a custom keypad enforces the alphabet instead of asking for it, and iOS's keyboard would
eat half the viewport); `dvh` rather than `vh` and a safe-area inset on every pinned bar;
actions at the bottom, in the thumb arc; the drawing autosaved to `sessionStorage` on
every change so a locked phone loses nothing; undo at least thirty deep with a whole drag
as one entry; and Clear behind a confirmation, nowhere near Submit.

The drag-paint pointer handling is lifted from `milk/src/components/LoadingGrid.tsx` —
`releasePointerCapture` on `pointerdown`, because touch's implicit capture would otherwise
stop every cell but the first from ever seeing the drag.

On the round where the shape is already known, the main surface is not the grid at all but
a ribbon of the snake in path order with a cursor, so decoding is "advance, press plus or
minus" rather than hunting a 23-pixel target in two dimensions. The physical act of
filling it in matches the structure of the message.

### The colour ramp

`telephone/src/app.css` adds nine tokens the shared theme does not have, and they are
**puzzle data only** — `bg-snake-*` on a grid cell, never a border, label, button or rule.
The shared accent still means exactly one thing, and twenty coloured squares on a board
must not be allowed to dilute it.

The ramp is *ordered*, and that is load-bearing rather than decorative. Lightness rises
with level in both light and dark — never
inverted for dark mode, because the two halves of a team are looking at different phones
and a ramp that reversed between them would have them describing opposite things in the
same words. That monotonicity is also what keeps the order readable for colourblind
viewers, with the hue path from indigo through cerulean to sage as a second cue. The hues
run 265° to 110°, well clear of the accent's 35°, which is why no warm sequential scale
would do.

## Where the leaderboards live

(The poster has no leaderboard — it stores nothing at all, and Telephone's standings
live in its Durable Object rather than in any browser.)

`localStorage`, in one browser profile, on one machine. Each interactive keeps its
own board under its own key (`cpatgt:leaderboard:nim.v1`, `…:milk.v1`), so they never
collide. They survive reloads and restarts, but they do **not** sync anywhere, a
second booth laptop keeps completely separate boards, and clearing site data wipes
them. That is the direct consequence of having no backend, and is worth knowing
before someone tidies the browser mid-event.

`Ctrl` + `Shift` + `K` clears the board of whichever interactive is on screen.

## Deploying

Each interactive is a static bundle with `base: './'` and no backend, so it deploys
as three independent Cloudflare Pages projects — one per domain, one repo.

| Folder    | Pages project     | Output directory |
| --------- | ----------------- | ---------------- |
| `nim/`    | `cpatgt-nim`      | `nim/dist`       |
| `milk/`   | `cpatgt-milk`     | `milk/dist`      |
| `poster/` | `cpatgt-poster`   | `poster/dist`    |

Telephone is the exception: it has server state, so it is a **Worker** with a Durable
Object rather than a Pages project, and it serves its own client from `telephone/dist`
on the same origin as `/api`. It deploys with `wrangler deploy` from `telephone/`, which
the workflow does as a fourth step.

One thing it needs that the Pages projects do not: the API token wants **Workers
Scripts: Edit** alongside Pages: Edit. There is nothing else to configure — no secret and
no meeting variable, since a meeting is created by opening the board rather than by a
deploy.

`.github/workflows/deploy.yml` runs on every push to `main`: `npm ci`,
`npm audit signatures`, typecheck, tests, `npm run build`, then one upload per
project. Pull requests run the same checks and skip the uploads. Node comes from
`.nvmrc`, so CI and the booth machine build on the same version.

### One-time setup

1. Create the three direct-upload projects:

   ```sh
   npx wrangler pages project create cpatgt-nim    --production-branch main
   npx wrangler pages project create cpatgt-milk   --production-branch main
   npx wrangler pages project create cpatgt-poster --production-branch main
   ```

2. Cloudflare dashboard → My Profile → API Tokens → create a token with the
   **Cloudflare Pages: Edit** permission on the account.
3. GitHub repo → Settings → Secrets and variables → Actions, add
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
4. Per project: Workers & Pages → the project → Custom domains → attach the domain.
   Cloudflare issues the certificate; a domain outside Cloudflare DNS needs one CNAME
   pointing at `<project>.pages.dev`.

### Deploying by hand

The workflow is the source of truth, but a single interactive can be pushed straight
from a laptop — this is also the exact command each workflow step runs:

```sh
npm run build
npx wrangler pages deploy nim/dist --project-name=cpatgt-nim --branch=main
```

Leave `--branch` off and the upload becomes a preview deployment on its own URL,
which is a safe way to look at something before it reaches the booth domain.

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
other on kits-then-time, and `MicroLabel` takes a `size` so the poster can set it for
a room to read rather than forking the treatment.

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
dependencies**, and the dev toolchain is vite, typescript, tailwind, vitest, wrangler and
types. Telephone's worker adds no runtime dependency either: it is `fetch` and a Durable
Object, and the event stream is a `TransformStream` rather than a websocket library.
No router, no state library, no animation library, no UI kit. If a new dependency
looks necessary, check first whether fifty lines in `shared/` would do instead; that
is where `cn`, `formatDuration`, and the leaderboard store came from.

If `npm ci` ever fails on a missing platform binary, that is `ignore-scripts` doing
its job. Rebuild the one package that needs it (`npm rebuild esbuild`) rather than
turning the flag off.
