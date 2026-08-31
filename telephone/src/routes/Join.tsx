import { AppShell, Button, MicroLabel, Rule, cn, normalizeName } from '@cpatgt/shared';
import { MAX_NAME_LENGTH } from '@cpatgt/shared';
import { useState } from 'react';
import { Keypad } from '../components/Keypad.tsx';
import type { Role } from '../protocol/types.ts';
import { post, rememberSession } from '../transport/client.ts';

/**
 * Getting two phones onto the same team.
 *
 * One person starts a team and reads out a four-digit code; the other types it in and
 * takes the other seat. The code is the durable thing — it survives a reload, a
 * redeploy, and a phone running out of battery and being replaced — so recovering a
 * session is always "type the code again" rather than anything a volunteer has to
 * explain.
 */

type Stage =
  | { kind: 'choose' }
  | { kind: 'name' }
  | { kind: 'code' }
  | { kind: 'role'; code: string }
  | { kind: 'made'; name: string; code: string };

export function Join({ onJoined }: { onJoined: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: 'choose' });
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enter = async (joinCode: string, role: Role, takeover = false): Promise<void> => {
    setBusy(true);
    setError(null);
    const reply = await post<{ sessionId: string }>('/join', { code: joinCode, role, takeover });
    setBusy(false);
    if (!reply.ok) {
      setError(
        reply.error === 'seat_taken'
          ? 'Someone is already in that seat. Take it over?'
          : reply.message,
      );
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
          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink">Telephone</h1>
          <p className="text-sm text-ink-muted">
            One of you sees the snake. The other has to draw it.
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
              Join your partner
            </Button>
          </div>
        )}

        {stage.kind === 'name' && (
          <div className="flex flex-col gap-4">
            <MicroLabel as="h2">Team name</MicroLabel>
            {/*
              The one place in the app that raises the system keyboard, and the reason it
              is `text-lg`: anything under sixteen pixels makes iOS zoom the page on focus
              and it never quite zooms back.
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
                Read this to your partner. They tap <b>Join your partner</b> and type it in.
              </p>
            </div>
            <Rule />
            <MicroLabel as="h2">Which of you is which?</MicroLabel>
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => void enter(stage.code, 'sender')}
              >
                I&apos;ll send
              </Button>
              <Button
                variant="quiet"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => void enter(stage.code, 'receiver')}
              >
                I&apos;ll draw
              </Button>
            </div>
          </div>
        )}

        {stage.kind === 'code' && (
          <div className="flex flex-col gap-4">
            <MicroLabel as="h2">Join code</MicroLabel>
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex h-16 flex-1 items-center justify-center border font-mono text-3xl tnum text-ink',
                    i === code.length
                      ? 'border-accent bg-accent-soft'
                      : 'border-hairline-strong bg-ground-raised',
                  )}
                >
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
            <Keypad
              onDigit={(digit) => setCode((current) => (current + digit).slice(0, 4))}
              onBackspace={() => setCode((current) => current.slice(0, -1))}
              commitLabel="Next"
              commitDisabled={code.length !== 4}
              onCommit={() => setStage({ kind: 'role', code })}
            />
            <Button variant="ghost" onClick={() => setStage({ kind: 'choose' })}>
              Back
            </Button>
          </div>
        )}

        {stage.kind === 'role' && (
          <div className="flex flex-col gap-4">
            <MicroLabel as="h2">Team {stage.code}</MicroLabel>
            <p className="text-sm text-ink-muted">Take the seat your partner did not.</p>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={() => void enter(stage.code, 'receiver')}
            >
              I&apos;ll draw
            </Button>
            <Button
              variant="quiet"
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={() => void enter(stage.code, 'sender')}
            >
              I&apos;ll send
            </Button>
            {error !== null && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink">{error}</p>
                <div className="flex gap-2">
                  <Button
                    variant="quiet"
                    disabled={busy}
                    onClick={() => void enter(stage.code, 'receiver', true)}
                  >
                    Take over drawing
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={busy}
                    onClick={() => void enter(stage.code, 'sender', true)}
                  >
                    Take over sending
                  </Button>
                </div>
              </div>
            )}
            <Button variant="ghost" onClick={() => setStage({ kind: 'code' })}>
              Back
            </Button>
          </div>
        )}

        {error !== null && stage.kind !== 'role' && <p className="text-sm text-ink">{error}</p>}
      </div>
    </AppShell>
  );
}
