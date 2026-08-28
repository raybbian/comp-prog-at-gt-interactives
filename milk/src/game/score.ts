import { formatDuration } from '@cpatgt/shared';

/**
 * The board ranks on kits first and time only as a tie-break, because the riddle is
 * "how few kits do you need" — a fast win with nine kits is not the answer. Both are
 * packed into the one number the leaderboard store sorts on, kits in the high part
 * and milliseconds in the low.
 */
const TIME_CAP = 10_000_000;

export function encodeScore(kitsUsed: number, elapsedMs: number): number {
  const ms = Math.max(0, Math.min(Math.round(elapsedMs), TIME_CAP - 1));
  return kitsUsed * TIME_CAP + ms;
}

export function decodeScore(value: number): { kitsUsed: number; elapsedMs: number } {
  return {
    kitsUsed: Math.floor(value / TIME_CAP),
    elapsedMs: value % TIME_CAP,
  };
}

export function formatScore(value: number): string {
  const { kitsUsed, elapsedMs } = decodeScore(value);
  return `${kitsUsed} · ${formatDuration(elapsedMs)}`;
}
