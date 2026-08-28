const MAX_LENGTH = 12;

/**
 * Anything a stranger types on an unattended booth screen ends up on a display
 * facing the room, so names are narrowed to a printable set and screened against a
 * short blocklist. This is a speed bump, not moderation — a volunteer can always
 * clear the board.
 */
const BLOCKED = [
  'fuck', 'shit', 'cunt', 'bitch', 'dick', 'cock', 'slut', 'whore',
  'nigg', 'fag', 'rape', 'nazi', 'hitler', 'kike', 'spic', 'chink',
  'tranny', 'retard',
];

export type NameCheck =
  | { ok: true; name: string }
  | { ok: false; reason: 'empty' | 'blocked' };

export function normalizeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .trimStart()
    .slice(0, MAX_LENGTH);
}

export function checkName(raw: string): NameCheck {
  const name = normalizeName(raw).trim();
  if (name.length === 0) return { ok: false, reason: 'empty' };

  const flattened = name.toLowerCase().replace(/[^a-z]/g, '');
  if (BLOCKED.some((word) => flattened.includes(word))) {
    return { ok: false, reason: 'blocked' };
  }
  return { ok: true, name };
}

export { MAX_LENGTH as MAX_NAME_LENGTH };
