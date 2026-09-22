/**
 * Domain types for 奶酪大盜 / Cheese Thief.
 *
 * Vocabulary follows the Traditional Chinese edition, which is the edition this
 * app is modelled on:
 *   奶酪大盜 thief      — steals the cheese, must not be voted out
 *   貪睡鼠   sleepyhead — ordinary mouse
 *   背鍋鼠   scapegoat  — 6–8人 variant; wins by being voted out
 *   共犯     accomplice — a status, not a card: a 貪睡鼠 caught awake with the thief
 */

export type Hour = 1 | 2 | 3 | 4 | 5 | 6

export const HOURS: readonly Hour[] = [1, 2, 3, 4, 5, 6]

export type PlayerId = string

export type Role = 'thief' | 'sleepyhead' | 'scapegoat'

/** Which side a player scores for once the votes are in. */
export type Faction = 'thief' | 'sleepyheads' | 'scapegoat'

/**
 * What a mouse saw of the cheese at the hour it woke.
 * `tookIt` is the thief's own view.
 */
export type CheeseSighting = 'present' | 'taken' | 'gone' | 'tookIt'

export type TieRule =
  /** 中文規則：最高票平票時所有人一起翻牌，大盜在其中就算被抓到。 */
  | 'sleepyheadsWin'
  /** Publisher's later English clarification: a tie for top means the thief escapes. */
  | 'thiefWins'

export type VoteStyle =
  /** Pass the phone; each vote is entered privately. */
  | 'secret'
  /** 3-2-1 countdown, everyone points for real, then the table taps in the answers. */
  | 'open'

/** The rule set a given player count brings with it. Not user-configurable. */
export interface Preset {
  players: number
  dicePerPlayer: 1 | 2
  /** 背鍋鼠 is available at this player count (the table may still decline it). */
  scapegoatAvailable: boolean
  /** How many 共犯 the thief may recruit. 0 disables the mechanic entirely. */
  accompliceCap: number
  /** Whether a mouse waking alone may look under someone's 骰盅. */
  peekAllowed: boolean
  /** 4人 variant: the thief wakes at both of its numbers. */
  thiefWakesOnAllDice: boolean
}

export interface RulesConfig {
  tieRule: TieRule
  /** Honoured only where `Preset.scapegoatAvailable`. */
  useScapegoat: boolean
  voteStyle: VoteStyle
}

export interface GameSetup {
  /** Seat order. The phone is always passed in this order, never in hour order. */
  names: string[]
  rules: RulesConfig
}

export interface Player {
  id: PlayerId
  name: string
  /** Index in the pass order. */
  seat: number
  role: Role
  /** One die, or two in the 4人 variant. */
  dice: Hour[]
  /**
   * 4人 variant: which of the two dice this mouse chose to wake on.
   * `null` for everyone else, and for the 4人 thief, who wakes on both.
   */
  chosenDie: number | null
  isAccomplice: boolean
  /** Who this player looked under, if they woke alone and took the peek. */
  peekedAt: PlayerId | null
  vote: PlayerId | null
}

export type Phase =
  | 'reveal'
  | 'night'
  | 'discussion'
  | 'vote'
  | 'results'

export interface GameState {
  seed: number
  phase: Phase
  preset: Preset
  rules: RulesConfig
  players: Player[]
  thiefId: PlayerId
  /** Seat index whose turn it is to hold the phone, during any pass phase. */
  cursor: number
}

/** Everything one player privately learns from the night. Nothing more. */
export interface NightReport {
  playerId: PlayerId
  role: Role
  /** The hour(s) this player was awake. Two only for the 4人 thief. */
  hours: Hour[]
  /** Other players awake at one of those same hours. */
  awakeWith: PlayerId[]
  cheese: CheeseSighting
  /** True when this player was awake as the cheese was taken. */
  sawTheft: boolean
  isAccomplice: boolean
  /** Known to the thief and to their 共犯; null for everyone else. */
  thiefId: PlayerId | null
  /** Populated for the thief only. */
  accompliceIds: PlayerId[]
  /** This player woke alone and the rule set allows a look under a 骰盅. */
  canPeek: boolean
  peekedAt: { playerId: PlayerId; dice: Hour[] } | null
}

export interface VoteTally {
  counts: Record<PlayerId, number>
  /** Everyone level on the highest count. They all flip their cards. */
  topIds: PlayerId[]
  highest: number
}

export interface Outcome {
  tally: VoteTally
  thiefCaught: boolean
  /** Sides that won. More than one can win at once, thanks to 背鍋鼠. */
  winningFactions: Faction[]
  winnerIds: PlayerId[]
  thiefId: PlayerId
  accompliceIds: PlayerId[]
  scapegoatId: PlayerId | null
}

export type Action =
  | { type: 'chooseDie'; playerId: PlayerId; dieIndex: number }
  | { type: 'designateAccomplices'; ids: PlayerId[] }
  | { type: 'peek'; playerId: PlayerId; targetId: PlayerId }
  | { type: 'castVote'; playerId: PlayerId; targetId: PlayerId }
  /** Hand the phone on. Ends the phase when the last seat is done. */
  | { type: 'advance' }
  | { type: 'setTieRule'; tieRule: TieRule }
