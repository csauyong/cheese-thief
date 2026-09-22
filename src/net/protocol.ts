import type {
  Action,
  Hour,
  NightReport,
  Outcome,
  Phase,
  PlayerId,
  Preset,
  Role,
  RulesConfig,
} from '../engine'

export const PROTOCOL_VERSION = 1

/** How long each hour of the night lasts, identical for every hour. */
export const HOUR_MS = 15_000

export type Stage = 'lobby' | Phase

/** What everyone at the table may know about a player. Nothing secret here. */
export interface ViewPlayer {
  id: PlayerId
  name: string
  seat: number
  connected: boolean
  /** Has finished whatever the current step asked of them. */
  ready: boolean
  /** Has cast a vote. Which way is nobody's business until the reveal. */
  voted: boolean
}

/**
 * One player's whole picture of the room.
 *
 * This is the leak boundary for the networked game: the host builds a separate
 * view per player and sends each phone only its own, so secrets are kept by what
 * crosses the wire rather than by what the UI remembers to hide. A client that
 * opened its developer console would find nothing but its own hand.
 */
export interface ClientView {
  v: number
  code: string
  stage: Stage
  isHost: boolean
  you: { id: PlayerId; name: string; seat: number } | null
  /** This player's own card and dice. Never anybody else's. */
  secret: {
    role: Role
    dice: Hour[]
    chosenDie: number | null
  } | null
  players: ViewPlayer[]
  preset: Preset | null
  rules: RulesConfig
  nightHour: Hour | null
  /** Epoch ms when the current hour ends, for the countdown on every phone. */
  hourEndsAt: number | null
  awakeNow: boolean
  pending: 'die' | 'accomplices' | null
  /** The thief's options, and only at the moment they have to choose. */
  witnesses: Array<{ id: PlayerId; name: string }>
  accompliceSlots: number
  /** This player's own account of the night, clamped to the hour reached. */
  night: NightReport | null
  vote: PlayerId | null
  outcome: Outcome | null
  waitingOn: PlayerId[]
  canStart: boolean
}

export type ClientMessage =
  | { t: 'hello'; v: number; token: string; name: string }
  | { t: 'action'; action: Action }
  | { t: 'start' }
  | { t: 'again' }
  | { t: 'setRules'; rules: RulesConfig }
  /** Host only: the narrator moving the room on. */
  | { t: 'advance' }

export type ServerMessage =
  | { t: 'view'; view: ClientView }
  | { t: 'error'; message: string }

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Four characters, no letters that read as digits over a noisy table. */
export function makeRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  }
  return code
}

export function normaliseRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
}

/** A ?room=CODE in the address bar means somebody scanned the host's QR. */
export function roomCodeFromUrl(): string {
  if (typeof window === 'undefined') return ''
  return normaliseRoomCode(new URLSearchParams(window.location.search).get('room') ?? '')
}
