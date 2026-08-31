/**
 * Which messages the channel swallows, on the one round that has a lossy channel.
 *
 * A pure function of the round seed, the team, the direction and the message's ordinal
 * — no stored state — so the verdict is the same whether it is computed when the
 * message is sent or reconstructed from the log afterwards, and a test can assert the
 * two agree.
 *
 * The scheme is a block quota rather than an independent coin per message. Both give
 * the same long-run rate, but a coin gives one team three losses and another nine over
 * the same twenty messages, and a team that is already having a bad round does not need
 * variance on top. A quota means every team pays exactly the same price; only *which*
 * messages they pay it on differs, which is the part that has to stay unpredictable.
 *
 * Keying includes the direction so that a chatty receiver cannot shift the sender's
 * schedule, and includes the team so nobody can learn the pattern by watching a
 * neighbour's phone.
 */

import { randInt, rngFrom } from './rng.ts';

/** Quota window. Ten is small enough that a short round still sees the true rate. */
export const BLOCK = 10;

export type Direction = 'sender' | 'receiver';

/** The positions inside one block that the channel will swallow. */
function dropPositions(
  roundSeed: string,
  teamId: string,
  dir: Direction,
  block: number,
  rate: number,
): Set<number> {
  const quota = Math.round(BLOCK * rate);
  const chosen = new Set<number>();
  if (quota <= 0) return chosen;
  if (quota >= BLOCK) {
    for (let i = 0; i < BLOCK; i += 1) chosen.add(i);
    return chosen;
  }

  const rng = rngFrom(roundSeed, teamId, dir, block);
  const slots = Array.from({ length: BLOCK }, (_, i) => i);
  for (let i = 0; i < quota; i += 1) {
    const pick = randInt(rng, slots.length);
    const [slot] = slots.splice(pick, 1);
    if (slot !== undefined) chosen.add(slot);
  }
  return chosen;
}

/**
 * `dirSeq` is the message's ordinal within its own direction for this team and round,
 * counting from zero — not the index in the combined log.
 */
export function isDropped(
  roundSeed: string,
  teamId: string,
  dir: Direction,
  dirSeq: number,
  rate: number,
): boolean {
  if (rate <= 0) return false;
  const block = Math.floor(dirSeq / BLOCK);
  const position = dirSeq % BLOCK;
  return dropPositions(roundSeed, teamId, dir, block, rate).has(position);
}
