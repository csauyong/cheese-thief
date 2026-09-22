import { presetFor } from './presets'
import { makeRng } from './rng'
import {
  accompliceSlots,
  awakeAt,
  canPeek,
  playerById,
  theftHourOf,
  thiefMustChooseAccomplices,
  wakeHoursOf,
  witnessesOf,
} from './rules'
import type {
  Action,
  GameSetup,
  GameState,
  Hour,
  Player,
  PlayerId,
  Role,
} from './types'
import { HOURS } from './types'

/**
 * Deal a round.
 *
 * Everything the night will produce is fixed right here — roles, dice, who is
 * awake with whom — apart from two choices a player has to make in person: the
 * 4人 die choice and the thief's pick of 共犯.
 *
 * When the choices are taken depends on the mode. On a shared phone both are
 * pulled forward into 身分揭曉, because the phone has to travel in seat order:
 * passing it in hour order would leak who woke before whom, and with the cheese
 * sighting that is the game given away. With a phone each there is no such
 * constraint, so the thief picks their 共犯 in the moment, at the theft hour,
 * the way they would at a real table.
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
    mode: setup.mode ?? 'hotseat',
    phase: 'reveal',
    preset,
    rules: { ...setup.rules, useScapegoat },
    players,
    thiefId: thief.id,
    cursor: 0,
    nightHour: null,
    ready: [],
  }

  // When there are no more witnesses than slots, every witness is recruited and
  // the thief has nothing to decide — settle it now so the reports are complete.
  if (!thiefMustChooseAccomplices(state)) {
    for (const witness of witnessesOf(state)) witness.isAccomplice = true
  }

  return state
}

export type PendingChoice = 'die' | 'accomplices' | null

/** What this player still owes before the round can move on. */
export function pendingChoiceFor(state: GameState, playerId: PlayerId): PendingChoice {
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return null

  const owesDieChoice =
    state.preset.dicePerPlayer > 1 && player.role !== 'thief' && player.chosenDie === null

  const owesAccomplices =
    player.id === state.thiefId &&
    thiefMustChooseAccomplices(state) &&
    state.players.filter((p) => p.isAccomplice).length < accompliceSlots(state)

  if (state.mode === 'live') {
    if (state.phase === 'reveal' && owesDieChoice) return 'die'
    // With a phone each the thief points at their 共犯 as it happens.
    if (state.phase === 'night' && state.nightHour === theftHourOf(state) && owesAccomplices) {
      return 'accomplices'
    }
    return null
  }

  if (state.phase !== 'reveal') return null
  if (owesDieChoice) return 'die'
  if (owesAccomplices) return 'accomplices'
  return null
}

/** Hotseat convenience: what the seat holding the phone still owes. */
export function pendingChoice(state: GameState): PendingChoice {
  if (state.mode === 'live') return null
  const player = currentPlayer(state)
  return player ? pendingChoiceFor(state, player.id) : null
}

export function currentPlayer(state: GameState): Player | null {
  if (state.mode === 'live') return null
  if (state.phase === 'discussion' || state.phase === 'results') return null
  return state.players.find((p) => p.seat === state.cursor) ?? null
}

/**
 * Live only: who the round is still waiting on. Empty means it can move on.
 *
 * During the night that is only the players actually awake at the hour being
 * called — everyone else is asleep and has nothing to do.
 */
export function pendingPlayers(state: GameState): PlayerId[] {
  if (state.mode !== 'live') return []

  const waitingOn = (players: Player[]) =>
    players
      .filter((p) => !state.ready.includes(p.id) || pendingChoiceFor(state, p.id) !== null)
      .map((p) => p.id)

  switch (state.phase) {
    case 'reveal':
      return waitingOn(state.players)
    case 'night':
      return state.nightHour === null
        ? []
        : waitingOn(awakeAt(state.players, state.preset, state.nightHour))
    case 'vote':
      return state.players.filter((p) => p.vote === null).map((p) => p.id)
    case 'discussion':
    case 'results':
      return []
  }
}

/** Live only: this player is awake for the hour currently being called. */
export function isAwakeNow(state: GameState, playerId: PlayerId): boolean {
  if (state.mode !== 'live' || state.phase !== 'night' || state.nightHour === null) return false
  const player = state.players.find((p) => p.id === playerId)
  if (!player) return false
  return wakeHoursOf(player, state.preset).includes(state.nightHour)
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
      const player = actingPlayer(next, action.playerId)
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
      const thief = actingPlayer(next, next.thiefId)
      if (pendingChoiceFor(next, thief.id) !== 'accomplices') {
        throw new Error('the thief has no 共犯 to designate right now')
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
      const player = actingPlayer(next, action.playerId)
      if (next.mode === 'live' && !isAwakeNow(next, player.id)) {
        throw new Error('this player is asleep right now')
      }
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
        next.rules.voteStyle === 'open' && next.mode === 'hotseat'
          ? playerById(next, action.playerId)
          : actingPlayer(next, action.playerId)
      if (action.targetId === player.id) throw new Error('cannot vote for yourself')
      playerById(next, action.targetId)
      player.vote = action.targetId
      return next
    }

    case 'ready': {
      if (next.mode !== 'live') throw new Error('readiness is only tracked with a phone each')
      const player = playerById(next, action.playerId)
      if (pendingChoiceFor(next, player.id) !== null) {
        throw new Error('this player still has a choice to make')
      }
      if (!next.ready.includes(player.id)) next.ready = [...next.ready, player.id]
      return next
    }

    case 'advance':
      return next.mode === 'live' ? advanceLive(next) : advanceHotseat(next)

    default: {
      const exhaustive: never = action
      throw new Error(`unknown action: ${JSON.stringify(exhaustive)}`)
    }
  }
}

function advanceHotseat(next: GameState): GameState {
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

function advanceLive(next: GameState): GameState {
  if (next.phase === 'results') return next

  // The night runs on a clock, not on readiness. If an hour with nobody awake
  // flashed past while a busy hour dragged, the length of each hour would tell
  // the table who was up — so the caller is free to move the night on whether or
  // not the players awake have finished, and every hour takes the same time.
  const clockDriven = next.phase === 'night' || next.phase === 'discussion'
  const waiting = pendingPlayers(next)
  if (waiting.length > 0 && !clockDriven) {
    throw new Error(`still waiting on ${waiting.join(', ')}`)
  }

  next.ready = []

  switch (next.phase) {
    case 'reveal':
      next.phase = 'night'
      next.nightHour = HOURS[0]
      return next
    case 'night': {
      const hour = next.nightHour ?? HOURS[HOURS.length - 1]
      // A thief who ran out of time still gets their 共犯: the rules give them
      // one, and letting the clock cost them it would be a worse deviation than
      // settling it for them.
      if (hour === theftHourOf(next) && pendingChoiceFor(next, next.thiefId) === 'accomplices') {
        const drafted = new Set(witnessesOf(next).slice(0, accompliceSlots(next)).map((p) => p.id))
        for (const player of next.players) player.isAccomplice = drafted.has(player.id)
      }
      if (hour < 6) {
        next.nightHour = (hour + 1) as Hour
        return next
      }
      next.nightHour = null
      next.phase = 'discussion'
      return next
    }
    case 'discussion':
      next.phase = 'vote'
      return next
    case 'vote':
      next.phase = 'results'
      return next
    default:
      return next
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

/**
 * Resolve who is acting. On a shared phone only the seat holding it may act; with
 * a phone each, everyone acts for themselves and the transport has already
 * established which player a message came from.
 */
function actingPlayer(state: GameState, playerId: PlayerId): Player {
  if (state.mode === 'live') return playerById(state, playerId)
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
    ready: state.ready.slice(),
    players: state.players.map((p) => ({ ...p, dice: p.dice.slice() })),
  }
}
