import type { Preset } from './types'

export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 8

/**
 * The player-count matrix. These are not house rules or optional extras — each
 * count ships its own balance, and the app applies it automatically.
 *
 * 4人 is its own beast: two dice each, the mice pick one number to wake on and
 * lose the peek, and the thief wakes on both of its numbers (once if they match).
 * That extra exposure is what replaces the missing 共犯.
 */
const PRESETS: Record<number, Preset> = {
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

export function presetFor(players: number): Preset {
  const preset = PRESETS[players]
  if (!preset) {
    throw new Error(`Cheese Thief supports ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${players}`)
  }
  return preset
}
