import { presetFor } from './presets'
import { makeRng } from './rng'
import {
  accompliceSlots,
  canPeek,
  playerById,
  thiefMustChooseAccomplices,
  witnessesOf,
} from './rules'
import type { Action, GameSetup, GameState, Hour, Player, PlayerId, Role } from './types'

/**
 * Deal a round.
 *
 * Everything the night will produce is fixed right here — roles, dice, who is
 * awake with whom — apart from two choices that a player has to make in person:
 * the 4人 die choice and the thief's pick of 共犯. Both are taken during 身分揭曉,
 * before any night report is shown, so that the phone can always travel in seat
 * order. Passing it in hour order would leak who woke before whom, and with the
 * cheese sighting that is the whole game given away.
 */
export function createGame(setup: GameSetup, seed: number): GameState {
  const preset = presetFor(setup.names.length)
  const rng = makeRng(seed)

  const useScapegoat = preset.scapegoatAvailable && setup.rules.useScapegoat
  const roles: Role[] = ['thief']
  if (useScapegoat) roles.push('scapegoat')
  while (roles.length < preset.players) roles.push('sleepyhead')

  const dealt = rng.shuffle(roles)
  const players: Player[] = setup.names.map((name, seat) => ({
    id: `p${seat}`,
    name,
    seat,
    role: dealt[seat],
    dice: Array.from({ length: preset.dicePerPlayer }, () => (rng.int(6) + 1) as Hour),
    chosenDie: null,
    isAccomplice: false,
    peekedAt: null,
    vote: null,
  }))

  const thief = players.find((p) => p.role === 'thief')
  if (!thief) throw new Error('deal produced no thief')

  const state: GameState = {
    seed,
    phase: 'reveal',
    preset,
    rules: { ...setup.rules, useScapegoat },
    players,
    thiefId: thief.id,
    cursor: 0,
  }

  // When there are no more witnesses than slots, every witness is recruited and
  // the thief has nothing to decide — settle it now so the reports are complete.
  if (!thiefMustChooseAccomplices(state)) {
    for (const witness of witnessesOf(state)) witness.isAccomplice = true
  }

  return state
}

/** What the player currently holding the phone still owes before passing it on. */
export function pendingChoice(state: GameState): 'die' | 'accomplices' | null {
  if (state.phase !== 'reveal') return null
  const player = currentPlayer(state)
  if (!player) return null
  if (
    state.preset.dicePerPlayer > 1 &&
    player.role !== 'thief' &&
    player.chosenDie === null
  ) {
    return 'die'
  }
  if (player.id === state.thiefId && thiefMustChooseAccomplices(state)) {
    const chosen = state.players.filter((p) => p.isAccomplice).length
    if (chosen < accompliceSlots(state)) return 'accomplices'
  }
  return null
}

export function currentPlayer(state: GameState): Player | null {
  if (state.phase === 'discussion' || state.phase === 'results') return null
  return state.players.find((p) => p.seat === state.cursor) ?? null
}

export function applyAction(state: GameState, action: Action): GameState {
  const next = clone(state)

  switch (action.type) {
    case 'setTieRule': {
      next.rules.tieRule = action.tieRule
      return next
    }

    case 'chooseDie': {
      expectPhase(next, 'reveal')
      const player = expectCurrent(next, action.playerId)
      if (next.preset.dicePerPlayer < 2) {
        throw new Error('there is only one die to wake on at this player count')
      }
      if (player.role === 'thief') {
        throw new Error('the 4人 thief wakes on both dice and makes no choice')
      }
      if (action.dieIndex < 0 || action.dieIndex >= player.dice.length) {
        throw new Error(`no die at index ${action.dieIndex}`)
      }
      player.chosenDie = action.dieIndex
      return next
    }

    case 'designateAccomplices': {
      expectPhase(next, 'reveal')
      if (currentPlayer(next)?.id !== next.thiefId) {
        throw new Error('only the thief, holding the phone, designates 共犯')
      }
      const slots = accompliceSlots(next)
      const eligible = new Set(witnessesOf(next).map((p) => p.id))
      const ids = Array.from(new Set(action.ids))
      if (ids.length !== slots) {
        throw new Error(`expected ${slots} 共犯, got ${ids.length}`)
      }
      for (const id of ids) {
        if (!eligible.has(id)) throw new Error(`${id} did not witness the theft`)
      }
      for (const player of next.players) player.isAccomplice = ids.includes(player.id)
      return next
    }

    case 'peek': {
      expectPhase(next, 'night')
      const player = expectCurrent(next, action.playerId)
      if (!canPeek(next, player.id)) {
        throw new Error('this player did not wake alone, so no 骰盅 may be lifted')
      }
      if (player.peekedAt !== null) throw new Error('already peeked this night')
      if (action.targetId === player.id) throw new Error('cannot peek at your own 骰盅')
      playerById(next, action.targetId)
      player.peekedAt = action.targetId
      return next
    }

    case 'castVote': {
      expectPhase(next, 'vote')
      const player =
        next.rules.voteStyle === 'open'
          ? playerById(next, action.playerId)
          : expectCurrent(next, action.playerId)
      if (action.targetId === player.id) throw new Error('cannot vote for yourself')
      playerById(next, action.targetId)
      player.vote = action.targetId
      return next
    }

    case 'advance': {
      if (next.phase === 'discussion') {
        next.phase = 'vote'
        next.cursor = 0
        return next
      }
      if (next.phase === 'results') return next
      if (pendingChoice(next)) {
        throw new Error('this player still has a choice to make')
      }
      if (next.phase === 'vote') {
        // Pointing for real is settled on one screen, so it ends the phase outright.
        if (next.rules.voteStyle === 'open') {
          if (!everyoneVoted(next)) throw new Error('not everyone has voted yet')
          next.phase = 'results'
          next.cursor = 0
          return next
        }
        if (currentPlayer(next)?.vote === null) {
          throw new Error('this player has not voted yet')
        }
      }

      next.cursor += 1
      if (next.cursor < next.players.length) return next

      next.cursor = 0
      if (next.phase === 'reveal') next.phase = 'night'
      else if (next.phase === 'night') next.phase = 'discussion'
      else if (next.phase === 'vote') next.phase = 'results'
      return next
    }

    default: {
      const exhaustive: never = action
      throw new Error(`unknown action: ${JSON.stringify(exhaustive)}`)
    }
  }
}

/** Every vote is in, so the tally may be revealed. */
export function everyoneVoted(state: GameState): boolean {
  return state.players.every((p) => p.vote !== null)
}

function expectPhase(state: GameState, phase: GameState['phase']): void {
  if (state.phase !== phase) {
    throw new Error(`expected phase ${phase}, but the game is in ${state.phase}`)
  }
}

function expectCurrent(state: GameState, playerId: PlayerId): Player {
  const player = currentPlayer(state)
  if (!player || player.id !== playerId) {
    throw new Error(`${playerId} is not holding the phone`)
  }
  return player
}

function clone(state: GameState): GameState {
  return {
    ...state,
    rules: { ...state.rules },
    players: state.players.map((p) => ({ ...p, dice: p.dice.slice() })),
  }
}
