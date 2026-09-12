import { MicroLabel, useFitScale } from '@cpatgt/shared';
import logoUrl from '@cpatgt/shared/assets/logo.png';
import { Snippet } from '../components/Snippet.tsx';
import { MAX_FINDINGS_CHARS } from '../protocol/codes.ts';
import { QUESTIONS } from '../protocol/questions.ts';
import { bugRung, COMPLEXITY_POINTS } from '../protocol/score.ts';

/**
 * What is on the projector while teams are joining.
 *
 * The worked example is the whole slide. Every team is about to spend 280 characters saying
 * what is wrong with some code, and the only thing standing between that and twenty
 * paragraphs of prose is seeing one answer written the way answers should be written: line
 * numbers, semicolons, no sentences. Explaining the format costs a paragraph nobody reads;
 * showing it costs four lines.
 *
 * The snippet on this slide is the warm-up question itself. That is deliberate — it is off
 * the record, so nothing is given away, and it means the first question of the evening is
 * one the room has already seen the shape of.
 *
 * Same vertical budget as the host board — 96 / 888 / 96, every section clipping rather than
 * growing — because a briefing slide that needs scrolling is one the room never finishes
 * reading.
 */

const W = 1920;
const H = 1080;

export function Briefing({ joinUrl }: { joinUrl: string }) {
  const scale = useFitScale(W, H);
  const host = joinUrl.replace(/^https?:\/\//, '');
  const example = QUESTIONS[0];

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
          <header className="flex h-24 shrink-0 items-center gap-5 border-b border-hairline px-14">
            <img src={logoUrl} alt="" aria-hidden="true" className="size-10" />
            <MicroLabel size="xl" className="text-ink">
              Competitive Programming at GT
            </MicroLabel>
          </header>

          {/* 888 */}
          <main className="grid min-h-0 flex-1 grid-cols-[820px_1100px]">
            <section className="flex min-h-0 flex-col justify-center gap-8 overflow-hidden border-r border-hairline px-14">
              <h1 className="text-[5.5rem] font-semibold leading-none tracking-[-0.03em]">
                Autopsy
              </h1>
              <p className="text-[2rem] leading-tight text-ink-muted">
                Eight snippets, all of them broken. Say what each one costs, and say
                everything it gets wrong.
              </p>

              <div className="flex flex-col gap-3 border-t border-hairline pt-8">
                <MicroLabel size="lg">Join on your phone</MicroLabel>
                <p className="font-mono text-[3.25rem] leading-none tnum">{host}</p>
              </div>

              <ol className="flex flex-col gap-3 text-[1.5rem] leading-snug text-ink-muted">
                <Step n="1" text="Sit in twos or threes." />
                <Step n="2" text="One of you taps Start a team and reads out four digits." />
                <Step n="3" text="The rest tap Join a team and type them in." />
                <Step n="4" text="Anyone on the team can submit. Only the last one counts." />
              </ol>

              <dl className="mt-auto flex gap-12 border-t border-hairline pt-8 pb-2">
                <Figure label="Complexity" value={String(COMPLEXITY_POINTS)} />
                <Figure label="1st bug" value={String(bugRung(1))} />
                <Figure label="2nd" value={String(bugRung(2))} />
                <Figure label="3rd" value={String(bugRung(3))} />
              </dl>
            </section>

            <section className="flex min-h-0 flex-col justify-center gap-7 overflow-hidden px-14">
              <MicroLabel size="lg">An answer, written the way answers should be</MicroLabel>
              {example !== undefined && <Snippet code={example.code} size="room" />}

              <div className="grid grid-cols-[220px_1fr] items-baseline gap-x-8 gap-y-4">
                <MicroLabel size="lg" className="text-ink">
                  Complexity
                </MicroLabel>
                <p className="font-mono text-[1.75rem] text-ink">O(n)</p>

                <MicroLabel size="lg" className="text-ink">
                  What&rsquo;s wrong
                </MicroLabel>
                <p className="font-mono text-[1.625rem] leading-snug text-ink">
                  line 2 total is never initialised; line 3 i &lt;= n reads a[n]; total
                  should be long long, it overflows
                </p>
              </div>

              <p className="border-t border-hairline pt-6 text-[1.5rem] leading-snug text-ink-muted">
                {MAX_FINDINGS_CHARS} characters for the bugs. Cite lines, separate with
                semicolons, and do not write sentences — “there might be an indexing
                problem” scores nothing, because it would be just as true of correct code.
              </p>
            </section>
          </main>

          {/* 96 */}
          <footer className="flex h-24 shrink-0 items-center justify-between border-t border-hairline px-14 text-[1.375rem] text-ink-faint">
            <span>The first one is a warm-up and does not count.</span>
            <span>Nobody will tell you how many bugs there are.</span>
            <span>These points carry into the contest.</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <li className="flex gap-4">
      <span className="font-mono tnum text-ink-faint">{n}</span>
      <span>{text}</span>
    </li>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <dt>
        <MicroLabel size="lg">{label}</MicroLabel>
      </dt>
      <dd className="font-mono text-[2.5rem] leading-none tnum text-ink">{value}</dd>
    </div>
  );
}
