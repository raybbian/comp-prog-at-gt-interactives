/**
 * Error codes and the two bits of input validation that matter.
 *
 * The client switches exhaustively on `ErrorCode`, so it is a union rather than loose
 * strings: adding a failure the UI does not handle should not compile.
 */

export const ERROR_CODES = [
  'bad_request',
  'bad_code',
  'bad_message',
  'bad_grid',
  'name_required',
  'seat_taken',
  'unknown_session',
  'wrong_role',
  'round_not_running',
  'nothing_received',
  'already_submitted',
  'too_fast',
  'no_room',
  'round_running',
  'server_full',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** The shape an action returns when it refuses. Server-side only; the wire uses status. */
export type Failure = { readonly ok: false; readonly error: ErrorCode; readonly message: string };

export function fail(error: ErrorCode, message: string): Failure {
  return { ok: false, error, message };
}

/**
 * Join codes are four digits and never start with zero.
 *
 * The leading zero is not a style choice — a code read off a projector, typed into a
 * phone and repeated across a noisy room loses its leading zero more often than any
 * other single failure, and the space is nine thousand wide either way.
 */
const CODE_PATTERN = /^[1-9][0-9]{3}$/;

export function isJoinCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/**
 * A room code is six digits, and the length is the point.
 *
 * Players type two numbers over an evening — the room they are in and the team they are
 * on — and the only thing stopping someone typing one into the other's box is that four
 * digits and six digits do not look alike. The wider space is a free side effect: room
 * codes are never recycled, so exhausting them should take longer than the club will.
 */
const ROOM_PATTERN = /^[1-9][0-9]{5}$/;

export function isRoomCode(value: string): boolean {
  return ROOM_PATTERN.test(value);
}

/**
 * Messages are digits, and there are only so many of them.
 *
 * Restricting the alphabet is the whole game. Let a letter through and the answer is
 * "row three is black"; keep it to digits and a team has to agree on what a digit means
 * before the clock starts. Malformed messages are rejected loudly rather than trimmed —
 * a silently altered message is a scoring mystery nobody can debug mid-round.
 */
export function messagePattern(maxDigits: number): RegExp {
  return new RegExp(`^[0-9]{1,${maxDigits}}$`);
}

export function isMessage(value: string, maxDigits: number): boolean {
  return messagePattern(maxDigits).test(value);
}

export function isGrid(value: string, cells: number): boolean {
  return value.length === cells && /^[0-9]*$/.test(value);
}
