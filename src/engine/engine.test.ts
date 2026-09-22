import { describe, expect, it } from 'vitest'

import {
  applyAction,
  createGame,
  currentPlayer,
  isAwakeNow,
  pendingChoice,
  pendingChoiceFor,
  pendingPlayers,
} from './engine'
import { presetFor } from './presets'
import {
  accompliceSlots,
  awakeAt,
  canPeek,
  cheeseSightingAt,
  decideOutcome,
  factionOf,
  nightReportFor,
  playerById,
  theftHourOf,
  thiefMustChooseAccomplices,
  wakeHoursOf,
  witnessesOf,
} from './rules'
import type {
  GameMode,
  GameSetup,
  GameState,
  Hour,
  Player,
  PlayerId,
  Role,
  RulesConfig,
} from './types'
import { HOURS } from './types'

const NAMES = ['Ada', 'Bo', 'Cai', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal']

function rules(over: Partial<RulesConfig> = {}): RulesConfig {
  return { tieRule: 'sleepyheadsWin', useScapegoat: true, voteStyle: 'secret', ...over }
}

function setup(players: number, over: Partial<RulesConfig> = {}): GameSetup {
  return { names: NAMES.slice(0, players), rules: rules(over) }
}

/**
 * Build an exact deal instead of fishing for one with a seed. Most rules only
 * misbehave in specific arrangements — three mice on the thief's hour, a 背鍋鼠
 * tied for top vote — and those are easier to state than to search for.
 */
function handDeal(
  spec: Array<{ role: Role; dice: Hour[]; chosenDie?: number }>,
  over: Partial<RulesConfig> = {},
  mode: GameMode = 'hotseat',
): GameState {
  const players: Player[] = spec.map((s, seat) => ({
    id: `p${seat}`,
    name: NAMES[seat],
    seat,
    role: s.role,
    dice: s.dice,
    chosenDie: s.chosenDie ?? null,
    isAccomplice: false,
    peekedAt: null,
    vote: null,
  }))
  const thief = players.find((p) => p.role === 'thief')!
  const state: GameState = {
    seed: 1,
    mode,
    phase: 'reveal',
    preset: presetFor(spec.length),
    rules: rules(over),
    players,
    thiefId: thief.id,
    cursor: 0,
    nightHour: null,
    ready: [],
  }
  if (!thiefMustChooseAccomplices(state)) {
    for (const witness of witnessesOf(state)) witness.isAccomplice = true
  }
  return state
}

/** A vote policy that is always legal: point at the next player round the table. */
const voteFirstOther = (s: GameState, p: Player): PlayerId =>
  s.players[(p.seat + 1) % s.players.length].id

/** Walk a whole round with a simple policy, so the invariants can be checked on real states. */
function playRound(state: GameState, voteFor: (s: GameState, p: Player) => PlayerId): GameState {
  let s = state
  while (s.phase === 'reveal') {
    const p = currentPlayer(s)!
    if (pendingChoice(s) === 'die') {
      s = applyAction(s, { type: 'chooseDie', playerId: p.id, dieIndex: 0 })
    }
    if (pendingChoice(s) === 'accomplices') {
      const ids = witnessesOf(s)
        .slice(0, accompliceSlots(s))
        .map((w) => w.id)
      s = applyAction(s, { type: 'designateAccomplices', ids })
    }
    s = applyAction(s, { type: 'advance' })
  }
  while (s.phase === 'night') {
    const p = currentPlayer(s)!
    if (canPeek(s, p.id)) {
      const target = s.players.find((o) => o.id !== p.id)!
      s = applyAction(s, { type: 'peek', playerId: p.id, targetId: target.id })
    }
    s = applyAction(s, { type: 'advance' })
  }
  s = applyAction(s, { type: 'advance' }) // discussion → vote
  while (s.phase === 'vote') {
    const p = currentPlayer(s)!
    s = applyAction(s, { type: 'castVote', playerId: p.id, targetId: voteFor(s, p) })
    s = applyAction(s, { type: 'advance' })
  }
  return s
}

describe('player-count presets', () => {
  it('gives 4人 two dice, no 共犯 and no peek', () => {
    const p = presetFor(4)
    expect(p.dicePerPlayer).toBe(2)
    expect(p.accompliceCap).toBe(0)
    expect(p.peekAllowed).toBe(false)
    expect(p.thiefWakesOnAllDice).toBe(true)
    expect(p.scapegoatAvailable).toBe(false)
  })

  it('scales the 共犯 cap: 1 at 5–6人, 2 at 7–8人', () => {
    expect(presetFor(5).accompliceCap).toBe(1)
    expect(presetFor(6).accompliceCap).toBe(1)
    expect(presetFor(7).accompliceCap).toBe(2)
    expect(presetFor(8).accompliceCap).toBe(2)
  })

  it('offers 背鍋鼠 only at 6–8人', () => {
    expect(presetFor(4).scapegoatAvailable).toBe(false)
    expect(presetFor(5).scapegoatAvailable).toBe(false)
    for (const n of [6, 7, 8]) expect(presetFor(n).scapegoatAvailable).toBe(true)
  })

  it('refuses player counts outside 4–8', () => {
    expect(() => presetFor(3)).toThrow()
    expect(() => presetFor(9)).toThrow()
  })
})

describe('the deal', () => {
  it('always deals exactly one 奶酪大盜, at every player count', () => {
    for (let n = 4; n <= 8; n++) {
      for (let seed = 0; seed < 40; seed++) {
        const s = createGame(setup(n), seed)
        expect(s.players.filter((p) => p.role === 'thief')).toHaveLength(1)
        expect(s.players).toHaveLength(n)
        expect(playerById(s, s.thiefId).role).toBe('thief')
      }
    }
  })

  it('deals 背鍋鼠 only where the count allows it and the table wants it', () => {
    for (let n = 4; n <= 8; n++) {
      for (let seed = 0; seed < 20; seed++) {
        const on = createGame(setup(n), seed).players.filter((p) => p.role === 'scapegoat')
        const off = createGame(setup(n, { useScapegoat: false }), seed).players.filter(
          (p) => p.role === 'scapegoat',
        )
        expect(on).toHaveLength(presetFor(n).scapegoatAvailable ? 1 : 0)
        expect(off).toHaveLength(0)
      }
    }
  })

  it('rolls the right number of dice, all of them real die faces', () => {
    for (let n = 4; n <= 8; n++) {
      const s = createGame(setup(n), n * 7)
      for (const p of s.players) {
        expect(p.dice).toHaveLength(presetFor(n).dicePerPlayer)
        for (const d of p.dice) expect(HOURS).toContain(d)
      }
    }
  })

  it('is reproducible from its seed, and different seeds do differ', () => {
    const a = createGame(setup(6), 12345)
    const b = createGame(setup(6), 12345)
    expect(b).toEqual(a)
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => JSON.stringify(createGame(setup(6), i).players)),
    )
    expect(seen.size).toBeGreaterThan(1)
  })
})

describe('the cheese', () => {
  it('is on the table before the theft, taken during it, and gone after', () => {
    for (const theftHour of HOURS) {
      for (const hour of HOURS) {
        const seen = cheeseSightingAt(hour, theftHour)
        if (hour < theftHour) expect(seen).toBe('present')
        else if (hour === theftHour) expect(seen).toBe('taken')
        else expect(seen).toBe('gone')
      }
    }
  })

  it('reports every mouse against the thief’s hour', () => {
    const s = handDeal([
      { role: 'thief', dice: [4] },
      { role: 'sleepyhead', dice: [2] },
      { role: 'sleepyhead', dice: [4] },
      { role: 'sleepyhead', dice: [6] },
      { role: 'sleepyhead', dice: [1] },
    ])
    expect(theftHourOf(s)).toBe(4)
    expect(nightReportFor(s, 'p0').cheese).toBe('tookIt')
    expect(nightReportFor(s, 'p1').cheese).toBe('present')
    expect(nightReportFor(s, 'p2').cheese).toBe('taken')
    expect(nightReportFor(s, 'p3').cheese).toBe('gone')
    expect(nightReportFor(s, 'p4').cheese).toBe('present')
  })
})

describe('共犯', () => {
  const threeOnTheThiefsHour = () =>
    handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [3] },
      { role: 'sleepyhead', dice: [3] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [1] },
    ])

  it('counts every mouse awake as the cheese goes as a witness', () => {
    const s = threeOnTheThiefsHour()
    expect(witnessesOf(s).map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('makes the thief choose when witnesses outnumber the slots', () => {
    const s = threeOnTheThiefsHour() // 5人 → cap 1, two witnesses
    expect(accompliceSlots(s)).toBe(1)
    expect(thiefMustChooseAccomplices(s)).toBe(true)
    const chosen = applyAction(s, { type: 'designateAccomplices', ids: ['p2'] })
    expect(chosen.players.filter((p) => p.isAccomplice).map((p) => p.id)).toEqual(['p2'])
  })

  it('refuses a 共犯 who was not there, or the wrong number of them', () => {
    const s = threeOnTheThiefsHour()
    expect(() => applyAction(s, { type: 'designateAccomplices', ids: ['p3'] })).toThrow()
    expect(() => applyAction(s, { type: 'designateAccomplices', ids: ['p1', 'p2'] })).toThrow()
    expect(() => applyAction(s, { type: 'designateAccomplices', ids: [] })).toThrow()
  })

  it('recruits everyone automatically when there is nothing to choose', () => {
    const s = createGame(setup(7), 3)
    // 7人 has two slots; with at most two witnesses the thief never picks.
    if (!thiefMustChooseAccomplices(s)) {
      expect(s.players.filter((p) => p.isAccomplice).map((p) => p.id)).toEqual(
        witnessesOf(s).map((p) => p.id),
      )
    }
  })

  it('never exceeds the cap, and every 共犯 is a witness', () => {
    for (let n = 4; n <= 8; n++) {
      for (let seed = 0; seed < 60; seed++) {
        const end = playRound(createGame(setup(n), seed), voteFirstOther)
        const accomplices = end.players.filter((p) => p.isAccomplice)
        expect(accomplices.length).toBeLessThanOrEqual(presetFor(n).accompliceCap)
        const witnessIds = witnessesOf(end).map((p) => p.id)
        for (const a of accomplices) expect(witnessIds).toContain(a.id)
      }
    }
  })

  it('never recruits the 背鍋鼠, who keeps its own win condition', () => {
    const s = handDeal([
      { role: 'thief', dice: [2] },
      { role: 'scapegoat', dice: [2] },
      { role: 'sleepyhead', dice: [4] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [6] },
    ])
    expect(witnessesOf(s)).toHaveLength(0)
    expect(nightReportFor(s, 'p1').sawTheft).toBe(true)
    expect(nightReportFor(s, 'p1').isAccomplice).toBe(false)
  })

  it('never appears at 4人', () => {
    for (let seed = 0; seed < 60; seed++) {
      const end = playRound(createGame(setup(4), seed), voteFirstOther)
      expect(end.players.some((p) => p.isAccomplice)).toBe(false)
    }
  })
})

describe('the peek', () => {
  it('is offered to a mouse that woke alone', () => {
    const s = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [6] },
    ])
    expect(canPeek(s, 'p1')).toBe(true)
    expect(canPeek(s, 'p4')).toBe(true)
    expect(canPeek(s, 'p2')).toBe(false) // shares 5 o'clock with p3
    expect(canPeek(s, 'p3')).toBe(false)
  })

  it('is never offered to the thief, even alone — their hands are full', () => {
    const s = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [6] },
      { role: 'sleepyhead', dice: [2] },
    ])
    expect(awakeAt(s.players, s.preset, 3)).toHaveLength(1)
    expect(canPeek(s, 'p0')).toBe(false)
  })

  it('is never offered at 4人', () => {
    for (let seed = 0; seed < 60; seed++) {
      let s = createGame(setup(4), seed)
      s = playRound(s, voteFirstOther)
      expect(s.players.some((p) => p.peekedAt !== null)).toBe(false)
    }
  })

  it('reveals the target’s dice and nothing else', () => {
    let s = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [6] },
    ])
    s = { ...s, phase: 'night', cursor: 1 }
    s = applyAction(s, { type: 'peek', playerId: 'p1', targetId: 'p0' })
    const report = nightReportFor(s, 'p1')
    expect(report.peekedAt).toEqual({ playerId: 'p0', dice: [3] })
    expect(report.thiefId).toBeNull()
    expect(() => applyAction(s, { type: 'peek', playerId: 'p1', targetId: 'p2' })).toThrow()
  })

  it('refuses a peek from a mouse that had company', () => {
    let s = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [6] },
    ])
    s = { ...s, phase: 'night', cursor: 1 }
    expect(() => applyAction(s, { type: 'peek', playerId: 'p1', targetId: 'p0' })).toThrow()
  })
})

describe('the 4人 variant', () => {
  const deal = () =>
    handDeal([
      { role: 'thief', dice: [2, 5] },
      { role: 'sleepyhead', dice: [1, 5] },
      { role: 'sleepyhead', dice: [3, 6] },
      { role: 'sleepyhead', dice: [2, 4] },
    ])

  it('wakes the thief on both numbers and steals at the earlier one', () => {
    const s = deal()
    expect(wakeHoursOf(playerById(s, 'p0'), s.preset)).toEqual([2, 5])
    expect(theftHourOf(s)).toBe(2)
  })

  it('wakes the thief once when the two dice match', () => {
    const s = handDeal([
      { role: 'thief', dice: [4, 4] },
      { role: 'sleepyhead', dice: [1, 5] },
      { role: 'sleepyhead', dice: [3, 6] },
      { role: 'sleepyhead', dice: [2, 4] },
    ])
    expect(wakeHoursOf(playerById(s, 'p0'), s.preset)).toEqual([4])
  })

  it('makes every mouse pick a number before the night is built', () => {
    const s = deal()
    expect(pendingChoice(s)).toBeNull() // seat 0 is the thief, who picks nothing
    const atSeat1 = { ...s, cursor: 1 }
    expect(pendingChoice(atSeat1)).toBe('die')
    expect(() => applyAction(atSeat1, { type: 'advance' })).toThrow()
    const chosen = applyAction(atSeat1, { type: 'chooseDie', playerId: 'p1', dieIndex: 1 })
    expect(wakeHoursOf(playerById(chosen, 'p1'), chosen.preset)).toEqual([5])
    expect(pendingChoice(chosen)).toBeNull()
  })

  it('refuses a die choice from the thief', () => {
    const s = deal()
    expect(() => applyAction(s, { type: 'chooseDie', playerId: 'p0', dieIndex: 0 })).toThrow()
  })

  it('lets a mouse meet the thief at either of the thief’s hours', () => {
    let s = deal()
    s = applyAction({ ...s, cursor: 1 }, { type: 'chooseDie', playerId: 'p1', dieIndex: 1 }) // 5
    s = applyAction({ ...s, cursor: 3 }, { type: 'chooseDie', playerId: 'p3', dieIndex: 0 }) // 2
    expect(nightReportFor(s, 'p1').awakeWith).toContain('p0') // met the thief at 5
    expect(nightReportFor(s, 'p3').awakeWith).toContain('p0') // and at 2, as it was taken
    expect(nightReportFor(s, 'p3').sawTheft).toBe(true)
    expect(nightReportFor(s, 'p1').sawTheft).toBe(false) // 5 o'clock is after the theft
    expect(nightReportFor(s, 'p1').cheese).toBe('gone')
  })
})

describe('the vote', () => {
  const votes = (state: GameState, map: Record<PlayerId, PlayerId>): GameState => ({
    ...state,
    phase: 'results',
    players: state.players.map((p) => ({ ...p, vote: map[p.id] ?? null })),
  })

  const fivePlayerDeal = () =>
    handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [3] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [6] },
    ])

  it('catches the thief on an outright majority, and the mice win', () => {
    const s = votes(fivePlayerDeal(), { p0: 'p1', p1: 'p0', p2: 'p0', p3: 'p0', p4: 'p0' })
    const out = decideOutcome(s)
    expect(out.tally.topIds).toEqual(['p0'])
    expect(out.thiefCaught).toBe(true)
    expect(out.winningFactions).toEqual(['sleepyheads'])
    expect(out.winnerIds).not.toContain('p0')
  })

  it('lets the thief and their 共犯 win when the vote lands elsewhere', () => {
    const base = fivePlayerDeal()
    const withAccomplice = {
      ...base,
      players: base.players.map((p) => (p.id === 'p1' ? { ...p, isAccomplice: true } : p)),
    }
    const s = votes(withAccomplice, { p0: 'p3', p1: 'p3', p2: 'p3', p3: 'p2', p4: 'p3' })
    const out = decideOutcome(s)
    expect(out.thiefCaught).toBe(false)
    expect(out.winningFactions).toEqual(['thief'])
    expect(out.winnerIds.sort()).toEqual(['p0', 'p1'])
  })

  describe('a tie for top', () => {
    const tied = () => votes(fivePlayerDeal(), { p0: 'p2', p1: 'p2', p2: 'p0', p3: 'p0', p4: null! })

    it('catches the thief under the Chinese rulebook', () => {
      const s = tied()
      const out = decideOutcome(s)
      expect(out.tally.topIds.sort()).toEqual(['p0', 'p2'])
      expect(out.thiefCaught).toBe(true)
      expect(out.winningFactions).toEqual(['sleepyheads'])
    })

    it('lets the thief escape under the publisher’s later clarification', () => {
      const s = { ...tied(), rules: rules({ tieRule: 'thiefWins' }) }
      const out = decideOutcome(s)
      expect(out.thiefCaught).toBe(false)
      expect(out.winningFactions).toEqual(['thief'])
    })
  })

  it('scores the 背鍋鼠 separately, so both it and the mice can win', () => {
    const base = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'scapegoat', dice: [4] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [6] },
      { role: 'sleepyhead', dice: [2] },
    ])
    // p0 (thief) and p1 (背鍋鼠) tie on two votes each.
    const s = votes(base, { p0: 'p1', p1: 'p0', p2: 'p0', p3: 'p1', p4: 'p5', p5: 'p2' })
    const out = decideOutcome(s)
    expect(out.tally.topIds.sort()).toEqual(['p0', 'p1'])
    expect(out.winningFactions.sort()).toEqual(['scapegoat', 'sleepyheads'])
    expect(out.winnerIds).toContain('p1')
  })

  it('lets the 背鍋鼠 win alone while the thief also gets away', () => {
    const base = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'scapegoat', dice: [4] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [6] },
      { role: 'sleepyhead', dice: [2] },
    ])
    const s = votes(base, { p0: 'p1', p1: 'p2', p2: 'p1', p3: 'p1', p4: 'p1', p5: 'p1' })
    const out = decideOutcome(s)
    expect(out.tally.topIds).toEqual(['p1'])
    expect(out.winningFactions.sort()).toEqual(['scapegoat', 'thief'])
  })

  it('refuses a vote for yourself', () => {
    const s = { ...fivePlayerDeal(), phase: 'vote' as const, cursor: 0 }
    expect(() => applyAction(s, { type: 'castVote', playerId: 'p0', targetId: 'p0' })).toThrow()
  })

  it('will not pass the phone on before a vote is cast', () => {
    const s = { ...fivePlayerDeal(), phase: 'vote' as const, cursor: 0 }
    expect(() => applyAction(s, { type: 'advance' })).toThrow()
  })

  it('puts 共犯 on the thief’s side of the scoreline', () => {
    const s = fivePlayerDeal()
    const accomplice = { ...s.players[1], isAccomplice: true }
    expect(factionOf(s.players[0], s.thiefId)).toBe('thief')
    expect(factionOf(accomplice, s.thiefId)).toBe('thief')
    expect(factionOf(s.players[2], s.thiefId)).toBe('sleepyheads')
  })
})

describe('the phone only ever travels in seat order', () => {
  it('runs reveal → night → discussion → vote → results, one seat at a time', () => {
    let s = createGame(setup(6), 99)
    const seen: Array<[string, number]> = []
    while (s.phase !== 'results') {
      seen.push([s.phase, s.cursor])
      const p = currentPlayer(s)
      if (p && pendingChoice(s) === 'die') {
        s = applyAction(s, { type: 'chooseDie', playerId: p.id, dieIndex: 0 })
      }
      if (p && pendingChoice(s) === 'accomplices') {
        const ids = witnessesOf(s).slice(0, accompliceSlots(s)).map((w) => w.id)
        s = applyAction(s, { type: 'designateAccomplices', ids })
      }
      if (s.phase === 'vote' && p) {
        const target = s.players.find((o) => o.id !== p.id)!
        s = applyAction(s, { type: 'castVote', playerId: p.id, targetId: target.id })
      }
      s = applyAction(s, { type: 'advance' })
    }
    const revealCursors = seen.filter(([ph]) => ph === 'reveal').map(([, c]) => c)
    expect(revealCursors).toEqual([0, 1, 2, 3, 4, 5])
    const nightCursors = seen.filter(([ph]) => ph === 'night').map(([, c]) => c)
    expect(nightCursors).toEqual([0, 1, 2, 3, 4, 5])
    expect(seen.filter(([ph]) => ph === 'discussion')).toHaveLength(1)
  })

  it('refuses an action from anyone but the seat holding the phone', () => {
    const s = createGame(setup(5), 7)
    expect(() =>
      applyAction({ ...s, phase: 'night' }, { type: 'peek', playerId: 'p4', targetId: 'p0' }),
    ).toThrow(/not holding the phone/)
  })
})

describe('the night leaks nothing', () => {
  it('never names a player the reader did not actually see', () => {
    for (let n = 4; n <= 8; n++) {
      for (let seed = 0; seed < 80; seed++) {
        const end = playRound(createGame(setup(n), seed), voteFirstOther)
        const theftHour = theftHourOf(end)

        for (const player of end.players) {
          const report = nightReportFor(end, player.id)
          const hours = wakeHoursOf(player, end.preset)
          const sharedHour = new Set(
            hours.flatMap((h) =>
              awakeAt(end.players, end.preset, h)
                .filter((o) => o.id !== player.id)
                .map((o) => o.id),
            ),
          )

          // Everyone named as awake alongside them really was.
          for (const id of report.awakeWith) expect(sharedHour.has(id)).toBe(true)
          expect(report.awakeWith).not.toContain(player.id)

          // The only other player a report may name is the one whose 骰盅 was lifted.
          const named = new Set([...report.awakeWith, ...report.accompliceIds])
          if (report.thiefId) named.add(report.thiefId)
          if (report.peekedAt) named.delete(report.peekedAt.playerId)
          const allowed = new Set(sharedHour)
          if (player.id === end.thiefId) {
            allowed.add(end.thiefId)
            for (const a of report.accompliceIds) allowed.add(a)
          }
          if (report.isAccomplice) allowed.add(end.thiefId)
          for (const id of named) expect(allowed.has(id)).toBe(true)

          // The thief's identity reaches witnesses — and nobody else.
          if (player.id !== end.thiefId) {
            expect(report.accompliceIds).toEqual([])
            if (report.sawTheft) expect(report.thiefId).toBe(end.thiefId)
            else if (!report.isAccomplice) expect(report.thiefId).toBeNull()
          }

          // Sighting and witness status follow strictly from the hour.
          if (player.id !== end.thiefId) {
            expect(report.sawTheft).toBe(hours.includes(theftHour))
            expect(report.cheese).toBe(cheeseSightingAt(hours[0], theftHour))
          } else {
            expect(report.cheese).toBe('tookIt')
            expect(report.sawTheft).toBe(false)
          }
        }
      }
    }
  })

  it('tells a 共犯 who the thief is, and the thief who their 共犯 are', () => {
    const s = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [3] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [6] },
    ])
    expect(thiefMustChooseAccomplices(s)).toBe(false) // one witness, one slot
    expect(nightReportFor(s, 'p1').thiefId).toBe('p0')
    expect(nightReportFor(s, 'p0').accompliceIds).toEqual(['p1'])
    expect(nightReportFor(s, 'p2').thiefId).toBeNull()
    expect(nightReportFor(s, 'p2').accompliceIds).toEqual([])
  })

  it('tells an unrecruited witness who the thief is, without making them 共犯', () => {
    // 5人 has one slot but two mice awake at 3 o'clock, so one is left out.
    let s = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [3] },
      { role: 'sleepyhead', dice: [3] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [1] },
    ])
    s = applyAction(s, { type: 'designateAccomplices', ids: ['p1'] })
    const spurned = nightReportFor(s, 'p2')
    expect(spurned.sawTheft).toBe(true)
    expect(spurned.isAccomplice).toBe(false)
    expect(spurned.thiefId).toBe('p0')
    expect(spurned.accompliceIds).toEqual([]) // they do not learn who was recruited
    expect(nightReportFor(s, 'p3').thiefId).toBeNull()
  })
})

describe('live mode: a phone each', () => {
  const liveDeal = () =>
    handDeal(
      [
        { role: 'thief', dice: [3] },
        { role: 'sleepyhead', dice: [3] },
        { role: 'sleepyhead', dice: [3] },
        { role: 'sleepyhead', dice: [5] },
        { role: 'sleepyhead', dice: [1] },
      ],
      {},
      'live',
    )

  const readyAll = (state: GameState, ids: PlayerId[]) =>
    ids.reduce((s, id) => applyAction(s, { type: 'ready', playerId: id }), state)

  it('waits for every player to see their card, then opens the night at one o’clock', () => {
    let s = liveDeal()
    expect(pendingPlayers(s)).toHaveLength(5)
    expect(() => applyAction(s, { type: 'advance' })).toThrow(/waiting on/)

    s = readyAll(s, ['p0', 'p1', 'p2', 'p3', 'p4'])
    expect(pendingPlayers(s)).toEqual([])
    s = applyAction(s, { type: 'advance' })
    expect(s.phase).toBe('night')
    expect(s.nightHour).toBe(1)
    expect(s.ready).toEqual([])
  })

  it('only waits on the players actually awake at the hour being called', () => {
    let s = readyAll(liveDeal(), ['p0', 'p1', 'p2', 'p3', 'p4'])
    s = applyAction(s, { type: 'advance' }) // → 1 o'clock

    expect(pendingPlayers(s)).toEqual(['p4']) // only p4 rolled a 1
    expect(isAwakeNow(s, 'p4')).toBe(true)
    expect(isAwakeNow(s, 'p0')).toBe(false)

    s = applyAction(s, { type: 'ready', playerId: 'p4' })
    s = applyAction(s, { type: 'advance' }) // → 2 o'clock
    expect(s.nightHour).toBe(2)
    expect(pendingPlayers(s)).toEqual([]) // nobody rolled a 2
  })

  it('makes the thief point at their 共犯 in the moment, not in advance', () => {
    let s = readyAll(liveDeal(), ['p0', 'p1', 'p2', 'p3', 'p4'])
    s = applyAction(s, { type: 'advance' })

    // Nothing to decide before the theft hour arrives.
    expect(pendingChoiceFor(s, 'p0')).toBeNull()
    expect(() => applyAction(s, { type: 'designateAccomplices', ids: ['p1'] })).toThrow()

    s = applyAction(s, { type: 'ready', playerId: 'p4' })
    s = applyAction(s, { type: 'advance' }) // 2
    s = applyAction(s, { type: 'advance' }) // 3 — the theft
    expect(s.nightHour).toBe(3)
    expect(pendingChoiceFor(s, 'p0')).toBe('accomplices')

    // The thief cannot slip away from the choice by declaring themselves ready.
    expect(() => applyAction(s, { type: 'ready', playerId: 'p0' })).toThrow()

    s = applyAction(s, { type: 'designateAccomplices', ids: ['p2'] })
    expect(s.players.filter((p) => p.isAccomplice).map((p) => p.id)).toEqual(['p2'])
    expect(pendingChoiceFor(s, 'p0')).toBeNull()
  })

  it('refuses an action from a player who is asleep right now', () => {
    let s = readyAll(liveDeal(), ['p0', 'p1', 'p2', 'p3', 'p4'])
    s = applyAction(s, { type: 'advance' }) // 1 o'clock; only p4 is up
    expect(() => applyAction(s, { type: 'peek', playerId: 'p3', targetId: 'p0' })).toThrow(
      /asleep/,
    )
    // p4 woke alone, so the peek is theirs to take.
    s = applyAction(s, { type: 'peek', playerId: 'p4', targetId: 'p0' })
    expect(nightReportFor(s, 'p4').peekedAt).toEqual({ playerId: 'p0', dice: [3] })
  })

  it('runs a whole round to a result, waiting on every vote', () => {
    let s = readyAll(liveDeal(), ['p0', 'p1', 'p2', 'p3', 'p4'])
    s = applyAction(s, { type: 'advance' })

    while (s.phase === 'night') {
      for (const id of pendingPlayers(s)) {
        if (pendingChoiceFor(s, id) === 'accomplices') {
          s = applyAction(s, { type: 'designateAccomplices', ids: ['p1'] })
        }
        s = applyAction(s, { type: 'ready', playerId: id })
      }
      s = applyAction(s, { type: 'advance' })
    }

    expect(s.phase).toBe('discussion')
    expect(s.nightHour).toBeNull()
    s = applyAction(s, { type: 'advance' })
    expect(s.phase).toBe('vote')

    expect(pendingPlayers(s)).toHaveLength(5)
    expect(() => applyAction(s, { type: 'advance' })).toThrow(/waiting on/)
    for (const p of s.players) {
      s = applyAction(s, { type: 'castVote', playerId: p.id, targetId: p.id === 'p0' ? 'p1' : 'p0' })
    }
    s = applyAction(s, { type: 'advance' })

    expect(s.phase).toBe('results')
    expect(decideOutcome(s).thiefCaught).toBe(true)
  })

  it('never consults the seat cursor', () => {
    const s = liveDeal()
    expect(currentPlayer(s)).toBeNull()
    expect(pendingChoice(s)).toBeNull()
    // Anyone may act for themselves, whatever the cursor happens to say.
    const moved = { ...s, cursor: 3 }
    expect(() => applyAction(moved, { type: 'ready', playerId: 'p0' })).not.toThrow()
  })

  it('keeps readiness out of the hotseat game entirely', () => {
    const s = handDeal([
      { role: 'thief', dice: [3] },
      { role: 'sleepyhead', dice: [1] },
      { role: 'sleepyhead', dice: [5] },
      { role: 'sleepyhead', dice: [6] },
      { role: 'sleepyhead', dice: [2] },
    ])
    expect(pendingPlayers(s)).toEqual([])
    expect(() => applyAction(s, { type: 'ready', playerId: 'p0' })).toThrow(/phone each/)
  })
})

describe('live mode: the night runs on a clock', () => {
  const deal = () =>
    handDeal(
      [
        { role: 'thief', dice: [3] },
        { role: 'sleepyhead', dice: [3] },
        { role: 'sleepyhead', dice: [3] },
        { role: 'sleepyhead', dice: [5] },
        { role: 'sleepyhead', dice: [1] },
      ],
      {},
      'live',
    )

  const intoNight = () => {
    let s = deal()
    for (const p of s.players) s = applyAction(s, { type: 'ready', playerId: p.id })
    return applyAction(s, { type: 'advance' })
  }

  it('moves on even with players still acting, so every hour can take the same time', () => {
    const s = intoNight()
    expect(pendingPlayers(s)).toEqual(['p4']) // p4 is up and has not finished
    expect(() => applyAction(s, { type: 'advance' })).not.toThrow()
    expect(applyAction(s, { type: 'advance' }).nightHour).toBe(2)
  })

  it('still gives a thief who ran out of time their 共犯', () => {
    let s = intoNight()
    s = applyAction(s, { type: 'advance' }) // 2
    s = applyAction(s, { type: 'advance' }) // 3 — the theft, two witnesses, one slot
    expect(pendingChoiceFor(s, 'p0')).toBe('accomplices')

    s = applyAction(s, { type: 'advance' }) // the hour runs out
    const accomplices = s.players.filter((p) => p.isAccomplice).map((p) => p.id)
    expect(accomplices).toHaveLength(1)
    expect(witnessesOf(s).map((p) => p.id)).toContain(accomplices[0])
  })

  it('leaves a thief’s own pick alone when they made one in time', () => {
    let s = intoNight()
    s = applyAction(s, { type: 'advance' })
    s = applyAction(s, { type: 'advance' })
    s = applyAction(s, { type: 'designateAccomplices', ids: ['p2'] })
    s = applyAction(s, { type: 'advance' })
    expect(s.players.filter((p) => p.isAccomplice).map((p) => p.id)).toEqual(['p2'])
  })

  it('still refuses to leave the reveal or the vote early', () => {
    const s = deal()
    expect(() => applyAction(s, { type: 'advance' })).toThrow(/waiting on/)
    const voting: GameState = { ...s, phase: 'vote' }
    expect(() => applyAction(voting, { type: 'advance' })).toThrow(/waiting on/)
  })
})
