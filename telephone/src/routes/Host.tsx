import { MicroLabel, cn, useFitScale } from '@cpatgt/shared';
import logoUrl from '@cpatgt/shared/assets/logo.png';
import { useEffect } from 'react';
import { SnakeGrid } from '../components/SnakeGrid.tsx';
import { formatClock } from '../format.ts';
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
 * The vertical budget is fixed and adds up exactly: a 96px rail, an 888px body, a 96px
 * rail. Every section inside the body is `min-h-0` and clips rather than growing, so no
 * number of teams can push the footer off the bottom or make the page scroll. A projector
 * screen that scrolls is a projector screen with content nobody will ever see.
 *
 * The hierarchy is deliberately steep, because a room reads exactly one thing at a time:
 * the clock dominates, the instruction supports it, the standings are for the people who
 * look over, and the team grid is for the host standing at the laptop. Two things
 * competing at the same size would mean neither is read.
 *
 * Light mode is pinned. A projector washes out a dark background, and the colour ramp on
 * one is mud.
 */

const W = 1920;
const H = 1080;

/** Four states in shape, not colour — see the note on the accent at the footer. */
const GLYPH: Record<HostTeamRow['activity'], string> = {
  waiting: '·',
  working: '○',
  sending: '◐',
  solved: '●',
};

const PHASE_LABEL: Record<string, string> = {
  brief: 'Agree how you will write it down',
  play: 'Send it',
  reveal: 'The answer',
  done: 'That is the lot',
};

export function Host({ view, meeting }: { view: HostView; meeting: Meeting<HostView> }) {
  const scale = useFitScale(W, H);
  const msLeft = useCountdown(view.round?.phaseEndsAt ?? null, meeting.skewMs);

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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [meeting, view.teamCount]);

  const round = view.round;
  const phase = round?.phase ?? 'lobby';
  const unpaired = view.teams.filter((t) => !t.paired);
  // Unpaired teams first: at a twenty-team event they are the one thing on this screen a
  // volunteer can actually walk over and fix.
  const ordered = [...unpaired, ...view.teams.filter((t) => t.paired)];
  const host = view.joinUrl.replace(/^https?:\/\//, '');

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
                Telephone
              </MicroLabel>
            </div>
            <MicroLabel size="xl">
              {round === null
                ? `${view.teamCount} teams joined`
                : `Round ${round.index} of ${round.total - 1}`}
            </MicroLabel>
          </header>

          {/* 888 */}
          <main className="grid min-h-0 flex-1 grid-cols-[1120px_800px]">
            <section className="flex min-h-0 flex-col justify-center gap-10 overflow-hidden border-r border-hairline px-14">
              {phase === 'lobby' ? (
                <>
                  <MicroLabel size="xl">Join on your phone</MicroLabel>
                  <p className="font-mono text-[5rem] leading-none tnum text-ink">{host}</p>
                  <p className="max-w-[900px] text-[2.25rem] leading-tight text-ink-muted">
                    One of you sees a snake. The other has to draw it. You get eight digits a
                    message, and nothing else.
                  </p>
                </>
              ) : (
                <>
                  {/* The clock is the one thing the whole room is looking at. */}
                  <div className="flex flex-col gap-3">
                    <MicroLabel size="xl">{PHASE_LABEL[phase] ?? ''}</MicroLabel>
                    <span
                      className={cn(
                        'font-mono text-[11rem] leading-[0.85] tnum tabular-nums',
                        msLeft > 0 && msLeft <= 60_000 ? 'text-accent' : 'text-ink',
                      )}
                    >
                      {formatClock(msLeft)}
                    </span>
                  </div>

                  {phase === 'reveal' && view.reveal !== null && round !== null ? (
                    <div className="w-[360px]">
                      <SnakeGrid
                        size={{ w: round.w, h: round.h }}
                        grid={view.reveal.target}
                        levels={round.levels}
                      />
                    </div>
                  ) : (
                    round !== null && (
                      <p className="max-w-[980px] text-[3rem] leading-[1.15] tracking-[-0.02em] text-ink">
                        {round.brief}
                      </p>
                    )
                  )}

                  {round !== null && (
                    <dl className="flex gap-14 border-t border-hairline pt-8">
                      <Figure label="Grid" value={`${round.w}×${round.h}`} />
                      <Figure label="Snake" value={String(round.snakeLength)} />
                      <Figure
                        label="Colours"
                        value={round.levels > 1 ? String(round.levels) : 'Mono'}
                      />
                      <Figure label="Solved" value={`${view.solvedCount}/${view.teamCount}`} />
                      <Figure label="Messages" value={String(view.messagesThisRound)} />
                    </dl>
                  )}
                </>
              )}
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden px-14 py-10">
              <MicroLabel size="xl" className="shrink-0">
                Standings
              </MicroLabel>

              <ol className="mt-6 flex shrink-0 flex-col">
                {view.standings.slice(0, 7).map((row) => (
                  <li
                    key={row.teamId}
                    className="flex h-[62px] items-center gap-5 border-b border-hairline"
                  >
                    <span className="w-9 font-mono text-[1.75rem] tnum text-ink-faint">
                      {row.rank}
                    </span>
                    <span className="flex-1 truncate text-[2rem] text-ink">{row.name}</span>
                    <span className="w-14 text-right font-mono text-[2rem] tnum text-ink">
                      {row.solved}
                    </span>
                    <span className="w-20 text-right font-mono text-[2rem] tnum text-ink-faint">
                      {row.messages}
                    </span>
                  </li>
                ))}
                {view.standings.length === 0 && (
                  <li className="py-8 text-[1.75rem] text-ink-faint">Nobody has joined yet.</li>
                )}
              </ol>

              {view.standings.length > 0 && (
                <div className="mt-3 flex shrink-0 justify-end gap-5">
                  <MicroLabel className="w-14 text-right">Solved</MicroLabel>
                  <MicroLabel className="w-20 text-right">Msgs</MicroLabel>
                </div>
              )}

              <MicroLabel size="lg" className="mt-auto shrink-0 pt-8">
                Every team
              </MicroLabel>
              <div className="mt-4 grid min-h-0 grid-cols-3 gap-x-6 gap-y-1 overflow-hidden">
                {ordered.slice(0, 24).map((team) => (
                  <div
                    key={team.teamId}
                    className={cn(
                      'flex items-baseline gap-2 text-[1.375rem] leading-8',
                      team.paired ? 'text-ink-muted' : 'text-ink',
                    )}
                  >
                    <span aria-hidden="true" className="w-3 shrink-0 font-mono">
                      {GLYPH[team.activity]}
                    </span>
                    <span className="truncate">{team.name}</span>
                    {!team.paired && (
                      <span className="ml-auto shrink-0 font-mono text-[1.25rem] tnum">
                        {team.code}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </main>

          {/* 96 — the host's own rail. The room is not reading this. */}
          <footer className="flex h-24 shrink-0 items-center justify-between border-t border-hairline px-14 text-[1.25rem] text-ink-faint">
            <span className="font-mono">{host}</span>
            <span>→ next · ← back · space pause · +/− 30s</span>
            <span className={cn(unpaired.length > 0 && 'text-ink')}>
              {unpaired.length === 0
                ? 'all teams paired'
                : `${unpaired.length} waiting for a partner`}
            </span>
          </footer>
        </div>
      </div>
    </div>
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
