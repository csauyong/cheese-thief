import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  accompliceSlots,
  applyAction,
  createGame,
  decideOutcome,
  everyoneVoted,
  hasWokenBy,
  isAwakeNow,
  nightReportFor,
  pendingChoiceFor,
  pendingPlayers,
  randomSeed,
  witnessesOf,
} from '../engine'
import type { GameState, PlayerId, RulesConfig } from '../engine'
import { HOUR_MS, PROTOCOL_VERSION } from './protocol'
import type { ClientMessage, ClientView, Stage, ViewPlayer } from './protocol'

export interface Member {
  /** Stable across reconnects — this is what puts someone back in their seat. */
  token: string
  peerId: string | null
  name: string
  seat: number
}

export interface RoomOptions {
  code: string
  hostToken: string
  hostName: string
  rules: RulesConfig
  seed?: () => number
  now?: () => number
  hourMs?: number
}

/**
 * The authoritative room. One of these lives in the host's tab and owns the
 * whole game; every other phone is a terminal that sends actions and renders the
 * view it is given.
 *
 * It is deliberately transport-free — it takes messages and hands back views —
 * so the whole thing can be exercised over an in-memory loopback in tests, with
 * only the WebRTC plumbing left untested.
 */
export class Room {
  readonly code: string
  private members: Member[] = []
  private rules: RulesConfig
  private game: GameState | null = null
  private hourEndsAt: number | null = null
  private readonly seed: () => number
  private readonly now: () => number
  private readonly hourMs: number

  constructor(options: RoomOptions) {
    this.code = options.code
    this.rules = options.rules
    this.seed = options.seed ?? randomSeed
    this.now = options.now ?? (() => Date.now())
    this.hourMs = options.hourMs ?? HOUR_MS
    this.members.push({
      token: options.hostToken,
      peerId: null,
      name: options.hostName,
      seat: 0,
    })
  }

  get hostToken(): string {
    return this.members[0]?.token ?? ''
  }

  get state(): GameState | null {
    return this.game
  }

  get roster(): Member[] {
    return this.members.slice()
  }

  isHost(token: string): boolean {
    return token === this.hostToken
  }

  /**
   * Seat a player, or put a returning one back where they were.
   *
   * Rejoining by token is what makes a dropped phone survivable: the same person
   * comes back to the same seat, with the same card, mid-round.
   */
  join(peerId: string, token: string, name: string): Member {
    const existing = this.members.find((m) => m.token === token)
    if (existing) {
      existing.peerId = peerId
      if (name.trim() && !this.game) existing.name = name.trim()
      return existing
    }
    if (this.game) throw new Error('the round has already started')
    if (this.members.length >= MAX_PLAYERS) throw new Error('the table is full')
    const member: Member = {
      token,
      peerId,
      name: name.trim() || `Player ${this.members.length + 1}`,
      seat: this.members.length,
    }
    this.members.push(member)
    return member
  }

  /** A phone went away. The seat is held: they may well be back. */
  leave(peerId: string): void {
    const member = this.members.find((m) => m.peerId === peerId)
    if (!member) return
    member.peerId = null
    // Before the deal there is no seat worth holding, so tidy up instead.
    if (!this.game && member.seat !== 0) {
      this.members = this.members
        .filter((m) => m !== member)
        .map((m, index) => ({ ...m, seat: index }))
    }
  }

  handle(token: string, message: ClientMessage): void {
    switch (message.t) {
      case 'hello':
        return
      case 'setRules':
        this.requireHost(token)
        if (this.game) throw new Error('the rules are settled once the cards are dealt')
        this.rules = message.rules
        return
      case 'start': {
        this.requireHost(token)
        if (this.game) throw new Error('already playing')
        this.deal()
        return
      }
      case 'again': {
        this.requireHost(token)
        this.deal()
        return
      }
      case 'advance': {
        this.requireHost(token)
        if (!this.game) throw new Error('no round in progress')
        this.game = applyAction(this.game, { type: 'advance' })
        this.afterStep()
        return
      }
      case 'action': {
        if (!this.game) throw new Error('no round in progress')
        const member = this.memberByToken(token)
        const playerId = `p${member.seat}`
        const action = message.action
        // A phone may only ever act for the person holding it.
        if ('playerId' in action && action.playerId !== playerId) {
          throw new Error('you may only act for yourself')
        }
        if (action.type === 'designateAccomplices' && playerId !== this.game.thiefId) {
          throw new Error('only the thief designates 共犯')
        }
        if (action.type === 'advance' || action.type === 'setTieRule') {
          throw new Error('that is the host’s to do')
        }
        this.game = applyAction(this.game, action)
        this.autoAdvance()
        return
      }
      default: {
        const exhaustive: never = message
        throw new Error(`unknown message: ${JSON.stringify(exhaustive)}`)
      }
    }
  }

  /**
   * Drive the night's clock. The host calls this on a timer.
   *
   * Every hour lasts exactly as long as every other, whether or not anybody is
   * awake for it. An hour that ended the moment its sleepers had nothing to do
   * would announce that nobody woke then.
   */
  tick(): boolean {
    if (!this.game || this.game.phase !== 'night' || this.hourEndsAt === null) return false
    if (this.now() < this.hourEndsAt) return false
    this.game = applyAction(this.game, { type: 'advance' })
    this.afterStep()
    return true
  }

  viewFor(token: string): ClientView {
    const member = this.members.find((m) => m.token === token)
    const game = this.game
    const stage: Stage = game ? game.phase : 'lobby'
    const playerId = member ? `p${member.seat}` : null

    // During the night, who is finished and who is still being waited on is the
    // same thing as who is awake — which is exactly what nobody may know. So
    // readiness is kept to the player it belongs to until morning.
    const nightIsOn = game?.phase === 'night'

    const players: ViewPlayer[] = this.members.map((m) => {
      const id = `p${m.seat}`
      const mine = id === playerId
      return {
        id,
        name: m.name,
        seat: m.seat,
        connected: m.peerId !== null || m.seat === 0,
        ready: game !== null && (mine || !nightIsOn) && game.ready.includes(id),
        voted: game ? game.players.find((p) => p.id === id)?.vote != null : false,
      }
    })

    const base: ClientView = {
      v: PROTOCOL_VERSION,
      code: this.code,
      stage,
      isHost: member ? this.isHost(member.token) : false,
      you: member ? { id: `p${member.seat}`, name: member.name, seat: member.seat } : null,
      secret: null,
      players,
      preset: game ? game.preset : null,
      rules: game ? game.rules : this.rules,
      nightHour: game ? game.nightHour : null,
      hourEndsAt: this.hourEndsAt,
      awakeNow: false,
      pending: null,
      witnesses: [],
      accompliceSlots: 0,
      night: null,
      vote: null,
      outcome: null,
      // Naming who the night is waiting on would name who is awake.
      waitingOn: game && !nightIsOn ? pendingPlayers(game) : [],
      canStart:
        !game && this.members.length >= MIN_PLAYERS && this.members.length <= MAX_PLAYERS,
    }

    if (!game || !playerId) return base

    const self = game.players.find((p) => p.id === playerId)
    if (!self) return base

    base.secret = { role: self.role, dice: self.dice, chosenDie: self.chosenDie }
    base.vote = self.vote
    base.pending = pendingChoiceFor(game, playerId)
    base.awakeNow = isAwakeNow(game, playerId)

    if (base.pending === 'accomplices') {
      base.witnesses = witnessesOf(game).map((p) => ({ id: p.id, name: p.name }))
      base.accompliceSlots = accompliceSlots(game)
    }

    // The night reaches a player only as far as the clock has got. Before the
    // reveal is over there is no night to speak of yet.
    if (game.phase === 'night' && game.nightHour !== null) {
      if (hasWokenBy(game, playerId, game.nightHour)) {
        base.night = nightReportFor(game, playerId, game.nightHour)
      }
    } else if (game.phase !== 'reveal') {
      base.night = nightReportFor(game, playerId)
    }

    if (game.phase === 'results') base.outcome = decideOutcome(game)

    return base
  }

  /** Every connected phone's view, ready to be sent. */
  views(): Array<{ peerId: string; view: ClientView }> {
    return this.members
      .filter((m): m is Member & { peerId: string } => m.peerId !== null)
      .map((m) => ({ peerId: m.peerId, view: this.viewFor(m.token) }))
  }

  private deal(): void {
    if (this.members.length < MIN_PLAYERS || this.members.length > MAX_PLAYERS) {
      throw new Error(`Cheese Thief needs ${MIN_PLAYERS}–${MAX_PLAYERS} players`)
    }
    const names = [...this.members].sort((a, b) => a.seat - b.seat).map((m) => m.name)
    this.game = createGame({ names, rules: this.rules, mode: 'live' }, this.seed())
    this.hourEndsAt = null
  }

  /** Readiness-driven steps move on by themselves; the night does not. */
  private autoAdvance(): void {
    const game = this.game
    if (!game) return
    if (game.phase === 'reveal' && pendingPlayers(game).length === 0) {
      this.game = applyAction(game, { type: 'advance' })
      this.afterStep()
      return
    }
    if (game.phase === 'vote' && everyoneVoted(game)) {
      this.game = applyAction(game, { type: 'advance' })
      this.afterStep()
    }
  }

  private afterStep(): void {
    const game = this.game
    if (!game) return
    this.hourEndsAt = game.phase === 'night' ? this.now() + this.hourMs : null
  }

  private requireHost(token: string): void {
    if (!this.isHost(token)) throw new Error('only the host can do that')
  }

  private memberByToken(token: string): Member {
    const member = this.members.find((m) => m.token === token)
    if (!member) throw new Error('you are not at this table')
    return member
  }
}

export function makeToken(random: () => number = Math.random): string {
  return Array.from({ length: 4 }, () => random().toString(36).slice(2, 10)).join('')
}

export type { PlayerId }
