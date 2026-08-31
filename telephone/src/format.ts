/**
 * `formatDuration` in shared renders tenths, which is right for a booth game you are
 * racing. A five-minute round counting down in tenths on forty phones is just anxiety,
 * and re-rendering ten times a second to produce it is waste, so this rounds to seconds.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `47120394` -> `471 203 94`. Eight digits are hard to keep your place in; three are not. */
export function groupDigits(digits: string): string {
  return digits.replace(/(.{3})/g, '$1 ').trim();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
