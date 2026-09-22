import { decideOutcome, factionOf } from '../engine'
import type { Faction, GameState, Role, RulesConfig } from '../engine'
import { readJson, remove, writeJson } from './storage'

const HISTORY_KEY = 'cheese-thief:history'
const SETUP_KEY = 'cheese-thief:setup'

export interface RoundPlayer {
  name: string
  role: Role
  isAccomplice: boolean
  faction: Faction
  hours: number[]
  won: boolean
}

export interface RoundRecord {
  round: number
  /** The deal's seed, used to make recording a round idempotent. */
  seed: number
  at: number
  players: RoundPlayer[]
  topNames: string[]
  winningFactions: Faction[]
  thiefName: string
}

export interface History {
  rounds: RoundRecord[]
}

export interface RememberedSetup {
  names: string[]
  rules: RulesConfig
}

const EMPTY: History = { rounds: [] }

export function loadHistory(): History {
  const raw = readJson<History>(HISTORY_KEY, EMPTY)
  return Array.isArray(raw.rounds) ? raw : EMPTY
}

export function clearHistory(): void {
  remove(HISTORY_KEY)
}

/**
 * Append a finished round, at most once per deal. The results screen can be
 * reached twice — React's strict mode, or simply a refresh with the round still
 * in storage — and a scoreboard that double-counts is worse than none.
 */
export function recordRound(state: GameState, wakeHours: (playerId: string) => number[]): History {
  const history = loadHistory()
  if (history.rounds.some((r) => r.seed === state.seed)) return history
  const outcome = decideOutcome(state)
  const winners = new Set(outcome.winnerIds)

  const record: RoundRecord = {
    round: history.rounds.length + 1,
    seed: state.seed,
    at: Date.now(),
    thiefName: state.players.find((p) => p.id === state.thiefId)?.name ?? '?',
    topNames: outcome.tally.topIds.map(
      (id) => state.players.find((p) => p.id === id)?.name ?? '?',
    ),
    winningFactions: outcome.winningFactions,
    players: state.players.map((p) => ({
      name: p.name,
      role: p.role,
      isAccomplice: p.isAccomplice,
      faction: factionOf(p, state.thiefId),
      hours: wakeHours(p.id),
      won: winners.has(p.id),
    })),
  }

  const next: History = { rounds: [...history.rounds, record] }
  writeJson(HISTORY_KEY, next)
  return next
}

export interface PlayerTotals {
  name: string
  played: number
  wins: number
  asThief: number
}

export interface FactionTotals {
  faction: Faction
  played: number
  wins: number
}

export interface Summary {
  rounds: number
  players: PlayerTotals[]
  factions: FactionTotals[]
}

export function summarise(history: History): Summary {
  const byName = new Map<string, PlayerTotals>()
  const byFaction = new Map<Faction, FactionTotals>()

  for (const round of history.rounds) {
    const winning = new Set(round.winningFactions)
    for (const p of round.players) {
      const totals = byName.get(p.name) ?? { name: p.name, played: 0, wins: 0, asThief: 0 }
      totals.played += 1
      if (p.won) totals.wins += 1
      if (p.role === 'thief') totals.asThief += 1
      byName.set(p.name, totals)
    }
    // A side is "played" in a round if anybody was on it — the 背鍋鼠 is not
    // always dealt, so its rate should not be diluted by rounds without one.
    for (const faction of new Set(round.players.map((p) => p.faction))) {
      const totals = byFaction.get(faction) ?? { faction, played: 0, wins: 0 }
      totals.played += 1
      if (winning.has(faction)) totals.wins += 1
      byFaction.set(faction, totals)
    }
  }

  const order: Faction[] = ['thief', 'sleepyheads', 'scapegoat']
  return {
    rounds: history.rounds.length,
    players: [...byName.values()].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
    factions: order.flatMap((f) => {
      const totals = byFaction.get(f)
      return totals ? [totals] : []
    }),
  }
}

export function loadSetup(): RememberedSetup | null {
  const stored = readJson<RememberedSetup | null>(SETUP_KEY, null)
  if (!stored || !Array.isArray(stored.names) || !stored.rules) return null
  return stored
}

export function saveSetup(setup: RememberedSetup): void {
  writeJson(SETUP_KEY, setup)
}
