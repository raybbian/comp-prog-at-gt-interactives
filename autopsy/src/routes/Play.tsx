import { AppShell, MicroLabel, Rule } from '@cpatgt/shared';
import { AnswerForm } from '../components/AnswerForm.tsx';
import { QuestionBar } from '../components/QuestionBar.tsx';
import { Snippet } from '../components/Snippet.tsx';
import type { PlayerView } from '../protocol/types.ts';
import { useCountdown } from '../state/useCountdown.ts';
import type { Meeting } from '../state/useMeeting.ts';
import { Waiting } from './Waiting.tsx';

/**
 * A question, on a phone.
 *
 * One scrolling column: what the code is meant to do, the code, then the two boxes. The
 * order is the order you need it in, and nothing is pinned — a fixed bar and the iOS
 * keyboard fight over the bottom of the viewport, and the keyboard wins, so the Submit
 * button lives directly under the box it submits instead.
 *
 * The intent line above the snippet is doing real work. Without it, "what is wrong with
 * this code" has no answer — you cannot call a loop bound wrong without knowing what it was
 * supposed to be. It says what the code is *for* and never what it does instead, which is
 * exactly the line between a specification and a hint.
 */
export function Play({
  view,
  meeting,
}: {
  view: PlayerView;
  meeting: Meeting<PlayerView>;
}) {
  const msLeft = useCountdown(view.question?.phaseEndsAt ?? null, meeting.skewMs);
  const question = view.question;

  if (question === null || question.phase !== 'play') {
    return <Waiting view={view} meeting={meeting} msLeft={msLeft} />;
  }

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
      <div className="flex flex-col gap-5 pb-16">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <MicroLabel as="h1">
              Question {question.index + 1}
              {!question.counts && ' · warm-up'}
            </MicroLabel>
            <span className="font-mono text-xs uppercase text-ink-faint">
              {question.language === 'cpp' ? 'C++' : 'Python'}
            </span>
          </div>
          <p className="text-sm text-ink">{question.intent}</p>
        </div>

        <Snippet code={question.code} size="phone" />

        <AnswerForm
          questionId={question.id}
          answer={view.answer}
          seat={view.seat}
          onSubmit={async (complexity, findings) => {
            const reply = await meeting.send('/answer', { complexity, findings });
            return reply.ok ? null : reply.message;
          }}
        />

        <Rule />
        <p className="text-xs text-ink-faint">
          {question.counts
            ? 'Nobody will tell you how many bugs there are.'
            : 'This one is a warm-up and does not count.'}
        </p>
      </div>
    </AppShell>
  );
}
