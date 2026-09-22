import type {
  CheeseSighting,
  Faction,
  GameState,
  Hour,
  NightReport,
  Outcome,
  Player,
  PlayerId,
  Preset,
  VoteTally,
} from './types'

/**
 * The hour(s) a player actually opens their eyes.
 *
 * One die means one hour. In the 4人 variant the mice hold two dice and pick
 * which number to wake on, while the thief wakes on both — or once, if the two
 * dice came up the same.
 *
 * Returns an empty array for a 4人 mouse who has not picked yet, which is why
 * the die choice is taken during 身分揭曉, before any night report is built.
 */
export function wakeHoursOf(player: Player, preset: Preset): Hour[] {
  if (preset.dicePerPlayer === 1) return [player.dice[0]]
  if (preset.thiefWakesOnAllDice && player.role === 'thief') {
    return uniqueSorted(player.dice)
  }
  if (player.chosenDie === null) return []
  return [player.dice[player.chosenDie]]
}

export function awakeAt(players: Player[], preset: Preset, hour: Hour): Player[] {
  return players.filter((p) => wakeHoursOf(p, preset).includes(hour))
}

/** The hour the cheese leaves the table: the thief's first waking hour. */
export function theftHourOf(state: GameState): Hour {
  const thief = playerById(state, state.thiefId)
  const hours = wakeHoursOf(thief, state.preset)
  if (hours.length === 0) {
    throw new Error('the thief has no waking hour — the deal is incomplete')
  }
  return hours.reduce((a, b) => (a < b ? a : b))
}

/**
 * What a mouse waking at `hour` sees on the table. The cheese is there before
 * the theft, vanishes during it, and is gone afterwards — which is the whole
 * deduction.
 */
export function cheeseSightingAt(hour: Hour, theftHour: Hour): CheeseSighting {
  if (hour < theftHour) return 'present'
  if (hour === theftHour) return 'taken'
  return 'gone'
}

/**
 * Mice who were awake as the cheese was taken, and so looked the thief in the eye.
 *
 * The 背鍋鼠 is deliberately excluded: they see the theft like anybody else, but
 * they keep their own win condition rather than joining the thief's side.
 */
export function witnessesOf(state: GameState): Player[] {
  const theftHour = theftHourOf(state)
  return state.players.filter(
    (p) =>
      p.id !== state.thiefId &&
      p.role !== 'scapegoat' &&
      wakeHoursOf(p, state.preset).includes(theftHour),
  )
}

/** How many 共犯 this deal actually produces. */
export function accompliceSlots(state: GameState): number {
  return Math.min(state.preset.accompliceCap, witnessesOf(state).length)
}

/**
 * True when the thief has a genuine choice to make. With as many slots as
 * witnesses every witness is recruited and there is nothing to decide.
 */
export function thiefMustChooseAccomplices(state: GameState): boolean {
  const slots = accompliceSlots(state)
  return slots > 0 && witnessesOf(state).length > slots
}

/**
 * A mouse that woke on its own may lift one 骰盅 and read the die beneath.
 * Never the thief — the thief's hands are full of cheese — and never at 4人.
 */
export function canPeek(state: GameState, playerId: PlayerId): boolean {
  if (!state.preset.peekAllowed) return false
  const player = playerById(state, playerId)
  if (player.role === 'thief') return false
  const hours = wakeHoursOf(player, state.preset)
  if (hours.length !== 1) return false
  return awakeAt(state.players, state.preset, hours[0]).length === 1
}

/**
 * Everything one player learns from the night — and, just as importantly,
 * nothing else. `engine.test.ts` asserts that no report names a player who was
 * neither awake alongside them nor the target of their peek.
 */
export function nightReportFor(state: GameState, playerId: PlayerId): NightReport {
  const player = playerById(state, playerId)
  const preset = state.preset
  const hours = wakeHoursOf(player, preset)
  const theftHour = theftHourOf(state)

  const awakeWith = uniqueIds(
    hours.flatMap((hour) =>
      awakeAt(state.players, preset, hour)
        .filter((p) => p.id !== playerId)
        .map((p) => p.id),
    ),
  )

  const isThief = player.id === state.thiefId
  const sawTheft = !isThief && hours.includes(theftHour)
  const cheese: CheeseSighting = isThief ? 'tookIt' : cheeseSightingAt(hours[0], theftHour)

  const accompliceIds = state.players.filter((p) => p.isAccomplice).map((p) => p.id)
  const peekTarget = player.peekedAt ? playerById(state, player.peekedAt) : null

  return {
    playerId,
    role: player.role,
    hours,
    awakeWith,
    cheese,
    sawTheft,
    isAccomplice: player.isAccomplice,
    // Anyone awake as the cheese went looked the thief in the eye, 共犯 or not.
    // A witness the thief did not recruit knows exactly who did it and has to be
    // believed on nothing but their word — which is the best seat in the game.
    thiefId: isThief || player.isAccomplice || sawTheft ? state.thiefId : null,
    accompliceIds: isThief ? accompliceIds : [],
    canPeek: canPeek(state, playerId) && player.peekedAt === null,
    peekedAt: peekTarget ? { playerId: peekTarget.id, dice: peekTarget.dice } : null,
  }
}

export function tallyVotes(players: Player[]): VoteTally {
  const counts: Record<PlayerId, number> = {}
  for (const p of players) counts[p.id] = 0
  for (const p of players) {
    if (p.vote && p.vote in counts) counts[p.vote] += 1
  }
  const highest = Math.max(0, ...Object.values(counts))
  const topIds = highest === 0 ? [] : players.filter((p) => counts[p.id] === highest).map((p) => p.id)
  return { counts, topIds, highest }
}

/**
 * 最高票的玩家翻開身分牌 — everyone level on the top count flips together.
 *
 * The 貪睡鼠 win if the 奶酪大盜 is among them; otherwise the thief and their
 * 共犯 get away with it. The tie rule decides whether being *tied* for top counts
 * as being caught: the Chinese rulebook says it does, the publisher's later
 * English clarification says it does not, and the table picks in settings.
 *
 * The 背鍋鼠 is scored separately, so a round can end with both the mice and the
 * 背鍋鼠 celebrating.
 */
export function decideOutcome(state: GameState): Outcome {
  const tally = tallyVotes(state.players)
  const thiefOnTop = tally.topIds.includes(state.thiefId)
  const soleTop = tally.topIds.length === 1

  const thiefCaught =
    state.rules.tieRule === 'thiefWins' ? thiefOnTop && soleTop : thiefOnTop

  const scapegoat = state.players.find((p) => p.role === 'scapegoat') ?? null
  const scapegoatWins = scapegoat !== null && tally.topIds.includes(scapegoat.id)

  const accompliceIds = state.players.filter((p) => p.isAccomplice).map((p) => p.id)

  const winningFactions: Faction[] = []
  if (thiefCaught) winningFactions.push('sleepyheads')
  else winningFactions.push('thief')
  if (scapegoatWins) winningFactions.push('scapegoat')

  const winnerIds = state.players
    .filter((p) => winningFactions.includes(factionOf(p, state.thiefId)))
    .map((p) => p.id)

  return {
    tally,
    thiefCaught,
    winningFactions,
    winnerIds,
    thiefId: state.thiefId,
    accompliceIds,
    scapegoatId: scapegoat ? scapegoat.id : null,
  }
}

/** Which side a player scores for. 共犯 score with the thief, not the mice. */
export function factionOf(player: Player, thiefId: PlayerId): Faction {
  if (player.id === thiefId) return 'thief'
  if (player.role === 'scapegoat') return 'scapegoat'
  if (player.isAccomplice) return 'thief'
  return 'sleepyheads'
}

export function playerById(state: GameState, id: PlayerId): Player {
  const player = state.players.find((p) => p.id === id)
  if (!player) throw new Error(`no such player: ${id}`)
  return player
}

function uniqueSorted(hours: Hour[]): Hour[] {
  return Array.from(new Set(hours)).sort((a, b) => a - b)
}

function uniqueIds(ids: PlayerId[]): PlayerId[] {
  return Array.from(new Set(ids))
}
