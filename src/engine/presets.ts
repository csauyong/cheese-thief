import type { Preset, RuleSet } from './types'

export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 8

/** The simple game needs a thief and two mice to vote between; there is no ceiling. */
export const SIMPLE_MIN_PLAYERS = 3

/**
 * The player-count matrix. These are not house rules or optional extras — each
 * count ships its own balance, and the app applies it automatically.
 *
 * 4人 is its own beast: two dice each, the mice pick one number to wake on and
 * lose the peek, and the thief wakes on both of its numbers (once if they match).
 * That extra exposure is what replaces the missing 共犯.
 */
const PRESETS: Record<number, Omit<Preset, 'ruleSet'>> = {
  4: {
    players: 4,
    dicePerPlayer: 2,
    scapegoatAvailable: false,
    accompliceCap: 0,
    peekAllowed: false,
    thiefWakesOnAllDice: true,
  },
  5: {
    players: 5,
    dicePerPlayer: 1,
    scapegoatAvailable: false,
    accompliceCap: 1,
    peekAllowed: true,
    thiefWakesOnAllDice: false,
  },
  6: {
    players: 6,
    dicePerPlayer: 1,
    scapegoatAvailable: true,
    accompliceCap: 1,
    peekAllowed: true,
    thiefWakesOnAllDice: false,
  },
  7: {
    players: 7,
    dicePerPlayer: 1,
    scapegoatAvailable: true,
    accompliceCap: 2,
    peekAllowed: true,
    thiefWakesOnAllDice: false,
  },
  8: {
    players: 8,
    dicePerPlayer: 1,
    scapegoatAvailable: true,
    accompliceCap: 2,
    peekAllowed: true,
    thiefWakesOnAllDice: false,
  },
}

/** How many players a rule set seats. `max` is Infinity for the simple game. */
export function playerRange(ruleSet: RuleSet = 'classic'): { min: number; max: number } {
  return ruleSet === 'simple'
    ? { min: SIMPLE_MIN_PLAYERS, max: Infinity }
    : { min: MIN_PLAYERS, max: MAX_PLAYERS }
}

export function seatsPlayers(players: number, ruleSet: RuleSet = 'classic'): boolean {
  const { min, max } = playerRange(ruleSet)
  return Number.isInteger(players) && players >= min && players <= max
}

export function presetFor(players: number, ruleSet: RuleSet = 'classic'): Preset {
  if (ruleSet === 'simple') {
    if (!seatsPlayers(players, 'simple')) {
      throw new Error(`the simple game needs at least ${SIMPLE_MIN_PLAYERS} players, got ${players}`)
    }
    // Every special rule off: one die, one waking, nothing to choose or lift.
    return {
      ruleSet,
      players,
      dicePerPlayer: 1,
      scapegoatAvailable: false,
      accompliceCap: 0,
      peekAllowed: false,
      thiefWakesOnAllDice: false,
    }
  }
  const preset = PRESETS[players]
  if (!preset) {
    throw new Error(`Cheese Thief supports ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${players}`)
  }
  return { ruleSet, ...preset }
}
