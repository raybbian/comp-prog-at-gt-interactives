import { AppShell, Button, MicroLabel, Rule, normalizeName } from '@cpatgt/shared';
import { MAX_NAME_LENGTH } from '@cpatgt/shared';
import { useState } from 'react';
import { CodeEntry } from '../components/CodeEntry.tsx';
import { post, rememberSession } from '../transport/client.ts';

/**
 * Getting a group of people onto one team.
 *
 * One person starts a team and reads out a four-digit code; everyone else types it in. There
 * are no roles and no seat to lose — everyone who has the code is on the team and everyone
 * can submit — so this screen is two buttons deep and nothing more. The code is the durable
 * thing: it survives a reload, a redeploy, and a phone running out of battery, so recovering
 * a session is always "type the code again" rather than anything a volunteer has to explain.
 *
 * Four digits here against six for the room, and that difference is load-bearing: it is the
 * box count, not the label, that tells someone which of the evening's two numbers they are
 * being asked for.
 */

type Stage =
  | { kind: 'choose' }
  | { kind: 'name' }
  | { kind: 'code' }
  | { kind: 'made'; name: string; code: string };

export function Join({ onJoined }: { onJoined: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: 'choose' });
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enter = async (joinCode: string): Promise<void> => {
    setBusy(true);
    setError(null);
    const reply = await post<{ sessionId: string }>('/join', { code: joinCode });
    setBusy(false);
    if (!reply.ok) {
      setError(reply.message);
      return;
    }
    rememberSession(reply.data.sessionId);
    onJoined();
  };

  const create = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const reply = await post<{ code: string; name: string }>('/teams', { name });
    setBusy(false);
    if (!reply.ok) {
      setError(reply.message);
      return;
    }
    setStage({ kind: 'made', name: reply.data.name, code: reply.data.code });
  };

  return (
    <AppShell mark="Competitive Programming at GT" contentClassName="max-w-sm" align="start">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink">Autopsy</h1>
          <p className="text-sm text-ink-muted">
            Someone else&apos;s code. Say what it costs, and say what it gets wrong.
          </p>
        </div>

        <Rule />

        {stage.kind === 'choose' && (
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setStage({ kind: 'name' })}
            >
              Start a team
            </Button>
            <Button
              variant="quiet"
              size="lg"
              className="w-full"
              onClick={() => setStage({ kind: 'code' })}
            >
              Join a team
            </Button>
            <p className="text-xs text-ink-faint">
              Two to four people, sitting together. One phone is enough, but everyone can have
              their own.
            </p>
          </div>
        )}

        {stage.kind === 'name' && (
          <div className="flex flex-col gap-4">
            <MicroLabel as="h2">Team name</MicroLabel>
            {/*
              The one place in the app that raises the system keyboard for something other
              than an answer, and the reason it is `text-lg`: anything under sixteen pixels
              makes iOS zoom the page on focus and it never quite zooms back.
            */}
            <input
              value={name}
              onChange={(event) => setName(normalizeName(event.target.value))}
              maxLength={MAX_NAME_LENGTH}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="SEGFAULT"
              className="h-14 w-full border border-hairline-strong bg-ground-raised px-4 font-mono text-lg tracking-[0.08em] text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
            />
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busy || name.trim().length === 0}
              onClick={() => void create()}
            >
              Create team
            </Button>
            <Button variant="ghost" onClick={() => setStage({ kind: 'choose' })}>
              Back
            </Button>
          </div>
        )}

        {stage.kind === 'made' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <MicroLabel as="h2">{stage.name}</MicroLabel>
              <p className="font-mono text-6xl tnum tracking-[0.15em] text-ink">{stage.code}</p>
              <p className="text-sm text-ink-muted">
                Read this to the rest of your team. They tap <b>Join a team</b> and type it in.
              </p>
            </div>
            <Rule />
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={() => void enter(stage.code)}
            >
              I&apos;m in
            </Button>
          </div>
        )}

        {stage.kind === 'code' && (
          <div className="flex flex-col gap-4">
            <MicroLabel as="h2">Team code</MicroLabel>
            <p className="text-sm text-ink-muted">
              Four digits, from whoever on your team made it.
            </p>
            <CodeEntry
              length={4}
              value={code}
              onChange={setCode}
              commitLabel="Join"
              onCommit={() => void enter(code)}
              disabled={busy}
            />
            <Button variant="ghost" onClick={() => setStage({ kind: 'choose' })}>
              Back
            </Button>
          </div>
        )}

        {error !== null && <p className="text-sm text-ink">{error}</p>}
      </div>
    </AppShell>
  );
}
