import { AppShell, MicroLabel, Rule, cn } from '@cpatgt/shared';
import { QuestionBar } from '../components/QuestionBar.tsx';
import { Snippet } from '../components/Snippet.tsx';
import { Standings } from '../components/Standings.tsx';
import { ordinal, plural } from '../format.ts';
import { bugRung, COMPLEXITY_POINTS, maxPoints } from '../protocol/score.ts';
import type { PlayerView } from '../protocol/types.ts';
import type { Meeting } from '../state/useMeeting.ts';

/**
 * Everything that is not the question itself: waiting for the host, the pause while answers
 * are marked, the answer afterwards, and the final board.
 *
 * The reveal is the screen this game is actually for. It is a phone, standing up, next to
 * three people who have just argued about whether line 4 counts — so it leads with the bugs,
 * marks the ones the team got, and puts the number of *other* teams who found each one right
 * next to it. That last number is what turns a wrong answer into something worth knowing:
 * missing a bug eleven of fourteen teams found is a different conversation from missing the
 * one nobody saw.
 */
export function Waiting({
  view,
  meeting,
  msLeft,
}: {
  view: PlayerView;
  meeting: Meeting<PlayerView>;
  msLeft: number;
}) {
  const question = view.question;
  const phase = question?.phase ?? 'lobby';
  const alone = view.team.memberCount <= 1;

  return (
    <AppShell
      mark={view.team.name}
      align="start"
      contentClassName="max-w-md"
      trailing={
        <QuestionBar
          question={question}
          msLeft={msLeft}
          standing={view.standing}
          health={meeting.health}
        />
      }
    >
      <div className="flex flex-col gap-7 pb-12">
        {phase === 'lobby' && (
          <>
            <div className="flex flex-col gap-3">
              <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
                You&apos;re in
              </h1>
              <p className="text-sm text-ink-muted">
                You are phone {view.seat} of {plural(view.team.memberCount, 'phone')} on{' '}
                {view.team.name}. Anyone can submit; only the last answer counts.
              </p>
            </div>

            <div className="flex flex-col gap-2 border border-hairline-strong bg-ground-raised p-4">
              <MicroLabel as="h2" className="text-ink">
                {alone ? 'Get the rest of your team in' : 'Join code'}
              </MicroLabel>
              <p className="font-mono text-5xl tnum tracking-[0.15em] text-ink">
                {view.team.code}
              </p>
              <p className="text-sm text-ink-muted">
                They tap <b>Join a team</b> and type this in.
              </p>
            </div>

            <Rule />
            <Ladder />
          </>
        )}

        {phase === 'grading' && (
          <div className="flex flex-col gap-4">
            <MicroLabel as="h1" className="animate-[pulse-label_3s_ease-in-out_infinite] text-ink">
              Marking every team&apos;s answer
            </MicroLabel>
            {view.answer !== null && view.answer.submittedAt !== null && (
              <div className="flex flex-col gap-2 border border-hairline p-3">
                <MicroLabel as="h2">What you sent</MicroLabel>
                <p className="font-mono text-sm text-ink">{view.answer.complexity || '—'}</p>
                <p className="text-sm text-ink-muted">{view.answer.findings || '—'}</p>
              </div>
            )}
          </div>
        )}

        {(phase === 'reveal' || phase === 'done') && view.reveal !== null && question !== null && (
          <div className="flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-3">
              <MicroLabel as="h1" className="text-ink">
                Question {question.index + 1}
              </MicroLabel>
              {/* Out of what: a score on its own does not say whether a team left one bug
                  on the table or three. */}
              <span className="font-mono text-2xl tnum text-ink">
                {view.verdict === null ? '—' : `+${view.verdict.points}`}
                <span className="text-base text-ink-faint">
                  /{maxPoints(view.reveal.bugs.length)}
                </span>
              </span>
            </div>

            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <MicroLabel as="h2">Complexity</MicroLabel>
                <span className="font-mono text-xs tnum text-ink-faint">
                  {view.reveal.complexityFoundBy}/{view.reveal.teamCount} teams
                </span>
              </div>
              <p
                className={cn(
                  'font-mono text-2xl text-ink',
                  view.verdict?.complexityCorrect === true && 'text-ink',
                )}
              >
                {view.reveal.complexity}
                {view.verdict !== null && (
                  <span className="ml-3 text-sm text-ink-muted">
                    {view.verdict.complexityCorrect ? 'you had it' : 'you missed it'}
                  </span>
                )}
              </p>
              <p className="text-sm text-ink-muted">{view.reveal.complexityNote}</p>
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <MicroLabel as="h2">
                  {plural(view.reveal.bugs.length, 'bug')} in it
                </MicroLabel>
                <span className="font-mono text-xs tnum text-ink-faint">
                  you found {view.verdict?.bugIds.length ?? 0}
                </span>
              </div>
              <ol className="flex flex-col">
                {view.reveal.bugs.map((bug, i) => (
                  <li
                    key={bug.id}
                    className="flex gap-3 border-b border-hairline py-3 last:border-b-0"
                  >
                    {/* A filled or empty circle, not a colour. Shape survives a
                        colourblind reader and a washed-out phone screen alike. */}
                    <span
                      aria-hidden="true"
                      className="w-3 shrink-0 pt-0.5 font-mono text-sm text-ink"
                    >
                      {bug.yours ? '●' : '○'}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className={cn('text-sm', bug.yours ? 'text-ink' : 'text-ink-muted')}>
                        {bug.summary}
                      </p>
                      <p className="text-xs text-ink-faint">{bug.detail}</p>
                      <p className="font-mono text-xs tnum text-ink-faint">
                        {bug.foundBy}/{view.reveal === null ? 0 : view.reveal.teamCount} teams
                        {' · '}
                        {bugRung(i + 1)} for the {ordinal(i + 1)} you find
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {view.verdict !== null && view.verdict.note !== '' && (
              <section className="flex flex-col gap-2 border-l-2 border-hairline-strong pl-3">
                <MicroLabel as="h2">The marker said</MicroLabel>
                <p className="text-sm text-ink-muted">{view.verdict.note}</p>
              </section>
            )}

            <Rule />
            <Snippet code={question.code} size="phone" />
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
              That&apos;s the last one
            </h1>
            <p className="text-sm text-ink-muted">
              {view.standing === null
                ? 'Thanks for playing.'
                : `You finished ${ordinal(view.standing.rank)} on ${view.standing.points} points. Those points carry into the contest — the Codeforces score gets added to them.`}
            </p>
          </div>
        )}

        <Rule />
        <section className="flex flex-col gap-3">
          <MicroLabel as="h2">Standings</MicroLabel>
          <Standings rows={view.standings} highlightTeamId={view.team.id} />
        </section>
      </div>
    </AppShell>
  );
}

/** What things are worth. On the lobby screen, because it changes how a team plays. */
function Ladder() {
  return (
    <section className="flex flex-col gap-3">
      <MicroLabel as="h2">What things are worth</MicroLabel>
      <dl className="flex flex-col gap-2 text-sm">
        <Row label="The time complexity" value={`${COMPLEXITY_POINTS}`} />
        <Row label="The first bug you find" value={`${bugRung(1)}`} />
        <Row label="The second" value={`${bugRung(2)}`} />
        <Row label="The third" value={`${bugRung(3)}`} />
      </dl>
      <p className="text-xs text-ink-faint">Nobody tells you how many there are.</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono tnum text-ink">{value}</dd>
    </div>
  );
}
