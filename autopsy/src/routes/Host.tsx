import { MicroLabel, cn, useFitScale } from '@cpatgt/shared';
import logoUrl from '@cpatgt/shared/assets/logo.png';
import { useEffect } from 'react';
import { FitMono } from '../components/FitMono.tsx';
import { Snippet } from '../components/Snippet.tsx';
import { Standings } from '../components/Standings.tsx';
import { formatClock, plural } from '../format.ts';
import { bugRung, COMPLEXITY_POINTS } from '../protocol/score.ts';
import type { HostTeamRow, HostView } from '../protocol/types.ts';
import { useCountdown } from '../state/useCountdown.ts';
import type { Meeting } from '../state/useMeeting.ts';

/**
 * The projector.
 *
 * Composed once at 1920 by 1080 and scaled whole, the way the poster is — a lecture-hall
 * projector might be 1280 by 800, and a layout that reflowed would mean the type size
 * tested here is not the type size the room gets.
 *
 * The vertical budget is fixed and adds up exactly: a 96px rail, an 888px body, a 96px rail.
 * Every section inside the body is `min-h-0` and clips rather than growing, so no number of
 * teams can push the footer off the bottom or make the page scroll. A projector screen that
 * scrolls is a projector screen with content nobody will ever see.
 *
 * ## The board is never off the screen
 *
 * The right-hand column holds the standings in every phase, including the lobby and
 * including while a question is being read. These points are about to be added to a
 * Codeforces score, so they are not a between-rounds flourish — they are the thing teams are
 * playing towards, and a team deciding whether to spend their last minute on a third bug or
 * on the complexity needs to know where they are while they decide. It is a narrower column
 * than the code because the code is what the room is reading; it is permanent because the
 * board is what the room is playing.
 *
 * ## The hierarchy is the snippet, not the clock
 *
 * Telephone puts an eleven-rem clock in the middle of the projector, because there the clock
 * is the whole tension. Here the *code* is what forty people are reading off the wall, and a
 * clock competing with it at that size would be a clock people watched instead of reading.
 * So the clock sits in the top rail, large enough to read from the back and small enough to
 * lose an argument with a snippet.
 *
 * Light mode is pinned. A projector washes out a dark background.
 */

const W = 1920;
const H = 1080;

/** Four states in shape, not colour — the accent means a player's pending action. */
const GLYPH: Record<HostTeamRow['activity'], string> = {
  waiting: '·',
  reading: '○',
  answered: '◐',
  graded: '●',
};

export function Host({ view, meeting }: { view: HostView; meeting: Meeting<HostView> }) {
  const scale = useFitScale(W, H);
  const msLeft = useCountdown(view.question?.phaseEndsAt ?? null, meeting.skewMs);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (window.confirm('Reset the whole event? Every team and score is erased.')) {
          void meeting.send('/host/reset', { confirmTeamCount: view.teamCount });
        }
        return;
      }
      const control = (action: string, body: Record<string, unknown> = {}): void => {
        event.preventDefault();
        void meeting.send('/host/control', { action, ...body });
      };
      if (event.key === 'ArrowRight') control('next');
      else if (event.key === 'ArrowLeft') control('back');
      else if (event.key === ' ') control('pause');
      else if (event.key === '+' || event.key === '=') control('nudge', { ms: 30_000 });
      else if (event.key === '-') control('nudge', { ms: -30_000 });
      // The one control that is not about the clock: try the answers the grader gave up
      // on. Safe to press at any time, and does nothing when there are none.
      else if (event.key.toLowerCase() === 'g') control('regrade');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [meeting, view.teamCount]);

  const question = view.question;
  const phase = question?.phase ?? 'lobby';
  const host = view.joinUrl.replace(/^https?:\/\//, '');
  const unseated = view.teams.filter((t) => t.memberCount === 0);

  return (
    <div
      data-theme="light"
      className="flex h-dvh items-center justify-center overflow-hidden bg-ground"
    >
      <div style={{ width: W * scale, height: H * scale }}>
        <div
          style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          className="flex flex-col overflow-hidden bg-ground text-ink"
        >
          {/* 96 */}
          <header className="flex h-24 shrink-0 items-center justify-between border-b border-hairline px-14">
            <div className="flex items-center gap-5">
              <img src={logoUrl} alt="" aria-hidden="true" className="size-10" />
              <MicroLabel size="xl" className="text-ink">
                Autopsy
              </MicroLabel>
            </div>
            <div className="flex items-center gap-12">
              <MicroLabel size="xl">
                {question === null
                  ? `${plural(view.teamCount, 'team')} joined`
                  : `Question ${question.index + 1} of ${question.total}`}
              </MicroLabel>
              {phase === 'play' && (
                <span
                  className={cn(
                    'font-mono text-[3.5rem] leading-none tnum',
                    msLeft > 0 && msLeft <= 30_000 ? 'text-accent' : 'text-ink',
                  )}
                >
                  {formatClock(msLeft)}
                </span>
              )}
            </div>
          </header>

          {/* 888 */}
          <main className="grid min-h-0 flex-1 grid-cols-[1180px_740px]">
            <section className="flex min-h-0 flex-col gap-6 overflow-hidden border-r border-hairline px-14 py-9">
              {phase === 'lobby' && <Lobby host={host} room={view.room} />}

              {question !== null && phase === 'play' && (
                <>
                  <div className="flex items-baseline justify-between gap-6">
                    <p className="text-[2rem] leading-tight text-ink">{question.intent}</p>
                    <MicroLabel size="lg" className="shrink-0">
                      {question.language === 'cpp' ? 'C++' : 'Python'}
                      {!question.counts && ' · warm-up'}
                    </MicroLabel>
                  </div>
                  <Snippet code={question.code} size="room" className="min-h-0" />
                  <p className="mt-auto text-[1.375rem] text-ink-faint">
                    Time complexity, and everything wrong with it. Nobody will tell you how
                    many there are.
                  </p>
                </>
              )}

              {phase === 'grading' && <Grading view={view} />}

              {view.reveal !== null && (phase === 'reveal' || phase === 'done') && (
                <Answer view={view} />
              )}
            </section>

            {/* The board. Present in every phase — see the note at the top of this file. */}
            <section className="flex min-h-0 flex-col overflow-hidden px-14 py-9">
              <div className="flex shrink-0 items-baseline justify-between">
                <MicroLabel size="xl" className="text-ink">
                  Standings
                </MicroLabel>
                <MicroLabel size="lg">carries into the contest</MicroLabel>
              </div>

              <Standings rows={view.standings} size="room" limit={10} className="mt-6 shrink-0" />

              <MicroLabel size="lg" className="mt-auto shrink-0 pt-8">
                Every team
              </MicroLabel>
              {/*
                Names and states only. A team's join code is never published here — see the
                note on `HostTeamRow` — because a list of them on a wall would tell forty
                strangers how to walk into each other's teams. A team short of a phone is
                shown its own code by the phone that made it.
              */}
              <div className="mt-4 grid min-h-0 grid-cols-2 gap-x-8 gap-y-1 overflow-hidden">
                {[...unseated, ...view.teams.filter((t) => t.memberCount > 0)]
                  .slice(0, 22)
                  .map((team) => (
                    <div
                      key={team.teamId}
                      className={cn(
                        'flex items-baseline gap-2 text-[1.375rem] leading-8',
                        team.memberCount === 0 ? 'text-ink' : 'text-ink-muted',
                      )}
                    >
                      <span aria-hidden="true" className="w-3 shrink-0 font-mono">
                        {GLYPH[team.activity]}
                      </span>
                      <span className="truncate">{team.name}</span>
                      {team.memberCount > 1 && (
                        <span className="ml-auto shrink-0 font-mono text-[1.25rem] tnum">
                          {team.memberCount}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          </main>

          {/* 96 — the host's own rail. The room is not reading this. */}
          <footer className="flex h-24 shrink-0 items-center justify-between border-t border-hairline px-14 text-[1.25rem] text-ink-faint">
            <span className="font-mono">
              {host} · room {view.room}
            </span>
            <span>→ next · ← back · space pause · +/− 30s · g regrade</span>
            {/* The one place the grader's own excuse is shown. "invalid x-api-key" is a
                different evening from "rate limited", and a count of three tells you
                neither. The room is not reading this rail. */}
            <span className={cn((!view.graderReady || view.failedGrades > 0) && 'text-ink')}>
              {!view.graderReady
                ? 'no grader key — nothing will score'
                : view.failedGrades > 0
                  ? `${view.failedGrades} unmarked — press g${
                      view.lastGradeError === null ? '' : ` · ${view.lastGradeError}`
                    }`
                  : `${view.answeredCount}/${view.teamCount} answered · ${plural(view.memberCount, 'phone')}`}
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Lobby({ host, room }: { host: string; room: string }) {
  return (
    <>
      <div className="flex flex-col gap-3">
        <MicroLabel size="xl">Join on your phone at</MicroLabel>
        <FitMono text={host} max="3.5rem" className="text-ink" />
      </div>
      {/*
        The code is the largest thing on the screen for the whole of the lobby, and it is the
        accent because typing it is the one thing the room is being asked to do.
      */}
      <div className="flex flex-col gap-3">
        <MicroLabel size="xl">With the room code</MicroLabel>
        <p className="font-mono text-[8rem] leading-[0.85] tnum tracking-[0.08em] text-accent">
          {room}
        </p>
      </div>
      <p className="max-w-[1000px] text-[1.875rem] leading-tight text-ink-muted">
        Then sit in twos or threes. One of you starts a team and reads out its four digits; the
        rest type those in.
      </p>
      <dl className="mt-auto flex gap-14 border-t border-hairline pt-8">
        <Figure label="The complexity" value={String(COMPLEXITY_POINTS)} />
        <Figure label="1st bug" value={String(bugRung(1))} />
        <Figure label="2nd" value={String(bugRung(2))} />
        <Figure label="3rd" value={String(bugRung(3))} />
      </dl>
      <p className="text-[1.375rem] text-ink-faint">
        Nobody tells you how many bugs there are. That is why each one is worth more than the
        last.
      </p>
    </>
  );
}

function Grading({ view }: { view: HostView }) {
  const done = view.answeredCount - view.pendingGrades;
  return (
    <>
      <MicroLabel size="xl" className="animate-[pulse-label_3s_ease-in-out_infinite] text-ink">
        Marking
      </MicroLabel>
      <p className="font-mono text-[7rem] leading-none tnum text-ink">
        {done}
        <span className="text-ink-faint">/{view.answeredCount}</span>
      </p>
      <p className="max-w-[1000px] text-[2rem] leading-tight text-ink-muted">
        Nothing was marked while the clock was running, so no team could learn the answer by
        submitting twenty variations of it.
      </p>
      {view.failedGrades > 0 && (
        <p className="mt-auto text-[1.5rem] text-ink">
          {plural(view.failedGrades, 'answer')} could not be marked. Press <b>g</b> to try
          again.
        </p>
      )}
    </>
  );
}

function Answer({ view }: { view: HostView }) {
  const reveal = view.reveal;
  if (reveal === null) return null;
  return (
    <>
      <div className="flex shrink-0 items-baseline justify-between gap-6">
        <div className="flex items-baseline gap-8">
          <MicroLabel size="xl">Complexity</MicroLabel>
          <span className="font-mono text-[3.5rem] leading-none text-ink">
            {reveal.complexity}
          </span>
        </div>
        <span className="font-mono text-[1.75rem] tnum text-ink-faint">
          {reveal.complexityFoundBy}/{reveal.teamCount}
        </span>
      </div>
      <p className="shrink-0 text-[1.5rem] leading-snug text-ink-muted">{reveal.complexityNote}</p>

      <MicroLabel size="xl" className="shrink-0 border-t border-hairline pt-6">
        {plural(reveal.bugs.length, 'bug')}
      </MicroLabel>
      <ol className="flex min-h-0 flex-col overflow-hidden">
        {reveal.bugs.map((bug, i) => (
          <li key={bug.id} className="flex gap-6 border-b border-hairline py-4 last:border-b-0">
            <span className="w-10 shrink-0 font-mono text-[1.75rem] tnum text-ink-faint">
              {bugRung(i + 1)}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[1.75rem] leading-snug text-ink">{bug.summary}</p>
              <p className="text-[1.375rem] leading-snug text-ink-muted">{bug.detail}</p>
            </div>
            {/* The column that makes this worth projecting: how rare the finding was. */}
            <span className="ml-auto shrink-0 self-start font-mono text-[1.75rem] tnum text-ink-faint">
              {bug.foundBy}/{reveal.teamCount}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <dt>
        <MicroLabel size="lg">{label}</MicroLabel>
      </dt>
      <dd className="font-mono text-[2.75rem] leading-none tnum text-ink">{value}</dd>
    </div>
  );
}
