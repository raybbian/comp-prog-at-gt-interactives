/**
 * Everything that crosses the wire.
 *
 * Two rules hold throughout.
 *
 * **`| null`, never `?`.** `JSON.stringify` drops keys whose value is `undefined`, so an
 * optional property does not survive a round trip — and under `exactOptionalPropertyTypes`
 * the type you get back is not the type you sent. Optionality lives in the value.
 *
 * **Redaction is a type, not a filter.** `ReceiverView` has no `target` key while a round
 * is live, and no view a sender can see carries `delivered`. A receiver with devtools open
 * can read every byte the server sends them, so the only defence that holds is one where
 * leaking is a compile error rather than a review someone has to remember to do.
 */

export type Role = 'sender' | 'receiver';

/**
 * A round walks: teams get protocol time, then the clock runs, then the answer goes up.
 * `lobby` is before anything starts and `done` is after the last reveal.
 */
export type Phase = 'lobby' | 'brief' | 'play' | 'reveal' | 'done';

export type SeatState = 'empty' | 'held';

/** A message as either partner may see it. Notably absent: whether it arrived. */
export type PublicMessage = {
  readonly seq: number;
  readonly from: Role;
  readonly body: string;
  readonly sentAt: number;
};

/**
 * What a round tells the players. The drop *rate* is deliberately not here — they are
 * told at the briefing that one in five goes missing, and telling the client the exact
 * figure would let someone read it out of a response and work out the schedule.
 */
export type PublicRound = {
  readonly id: string;
  readonly index: number;
  readonly total: number;
  readonly w: number;
  readonly h: number;
  readonly levels: number;
  readonly shapeGiven: boolean;
  readonly lossy: boolean;
  readonly counts: boolean;
  readonly phase: Phase;
  readonly phaseEndsAt: number | null;
  readonly snakeLength: number;
};

/** Only ever present once the round is over. */
export type Reveal = {
  readonly target: string;
  readonly differences: readonly number[];
  /**
   * How few messages this picture could have taken — the information in it, not a record
   * anyone set. Which team did best is the leaderboard's job; this is the number that says
   * what was on the table.
   */
  readonly floor: number;
};

export type StandingRow = {
  readonly teamId: string;
  readonly name: string;
  readonly rank: number;
  readonly solved: number;
  readonly messages: number;
  readonly elapsedMs: number;
};

export type TeamPublic = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly sender: SeatState;
  readonly receiver: SeatState;
};

type PlayerViewBase = {
  readonly v: number;
  readonly serverTime: number;
  readonly team: TeamPublic;
  readonly round: PublicRound | null;
  /** The ordered snake, on rounds where both players are given the shape. */
  readonly shapePath: readonly number[] | null;
  readonly sent: readonly PublicMessage[];
  readonly received: readonly PublicMessage[];
  readonly messagesUsed: number;
  readonly solved: boolean;
  readonly reveal: Reveal | null;
  readonly standing: StandingRow | null;
};

/** The sender sees the picture. They never see whether a message landed. */
export type SenderView = PlayerViewBase & {
  readonly kind: 'sender';
  readonly target: string;
};

/** The receiver never sees the picture until the reveal. */
export type ReceiverView = PlayerViewBase & {
  readonly kind: 'receiver';
  readonly grid: string;
  readonly gridRev: number;
  readonly submittedAt: number | null;
};

export type PlayerView = SenderView | ReceiverView;

/**
 * Note what is not here: the join code. The board has no use for one — a code is read off
 * the phone of whoever made the team, by the partner sitting next to them, and the phone
 * shows it again by itself whenever a seat falls empty. Sending it anyway would publish
 * every team's code on an unauthenticated screen, and `takeover` is a button on the join
 * screen rather than an API call somebody has to know how to make.
 */
export type HostTeamRow = {
  readonly teamId: string;
  readonly name: string;
  readonly paired: boolean;
  readonly sender: SeatState;
  readonly receiver: SeatState;
  /** `waiting` | `working` | `sending` | `solved` — shape on the board, never colour. */
  readonly activity: 'waiting' | 'working' | 'sending' | 'solved';
  readonly messagesThisRound: number;
  readonly solvedThisRound: boolean;
};

export type HostView = {
  readonly kind: 'host';
  readonly v: number;
  readonly serverTime: number;
  readonly joinUrl: string;
  /** The six digits the room types in. This board is the only place they are published. */
  readonly room: string;
  readonly round: PublicRound | null;
  readonly reveal: Reveal | null;
  readonly teams: readonly HostTeamRow[];
  readonly standings: readonly StandingRow[];
  readonly solvedCount: number;
  readonly teamCount: number;
  readonly messagesThisRound: number;
};

export type AnyView = PlayerView | HostView;

/** What the pre-join splash needs, with no session at all. */
export type Lobby = {
  readonly kind: 'lobby';
  readonly serverTime: number;
  readonly room: string;
  readonly phase: Phase;
  readonly roundIndex: number | null;
  readonly teamCount: number;
  readonly joinOpen: boolean;
};

export type JoinResult = {
  readonly sessionId: string;
  readonly role: Role;
  readonly view: PlayerView;
};

export type SeatTaken = {
  readonly occupiedSince: number;
  readonly lastSeenAt: number;
};
