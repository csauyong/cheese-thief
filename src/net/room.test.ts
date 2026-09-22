import { describe, expect, it } from 'vitest'

import { HOURS, pendingChoiceFor, pendingPlayers, wakeHoursOf } from '../engine'
import type { GameState, PlayerId } from '../engine'
import { makeRoomCode, normaliseRoomCode } from './protocol'
import type { ClientView } from './protocol'
import { Room, makeToken } from './room'


const HOUR_MS = 1000

function makeRoom(names: string[], nowRef = { t: 0 }) {
  const tokens = names.map((_, i) => `token-${i}`)
  const room = new Room({
    code: 'TEST',
    hostToken: tokens[0],
    hostName: names[0],
    rules: { tieRule: 'sleepyheadsWin', useScapegoat: true, voteStyle: 'secret' },
    seed: () => 4242,
    now: () => nowRef.t,
    hourMs: HOUR_MS,
  })
  names.slice(1).forEach((name, i) => room.join(`peer-${i + 1}`, tokens[i + 1], name))
  return { room, tokens, nowRef }
}

const NAMES = ['Ada', 'Bo', 'Cai', 'Dee', 'Eve']

/** Every path in a view at which a `role` or `dice` key appears. */
function secretKeyPaths(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => secretKeyPaths(v, `${path}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, v]) => {
      const here = path ? `${path}.${key}` : key
      const found = key === 'role' || key === 'dice' ? [here] : []
      return [...found, ...secretKeyPaths(v, here)]
    })
  }
  return []
}

describe('rejoin tokens', () => {
  it('are long and distinct, so a stranger cannot guess into a seat', () => {
    const seen = new Set(Array.from({ length: 500 }, () => makeToken()))
    expect(seen.size).toBe(500)
    for (const token of seen) expect(token.length).toBeGreaterThanOrEqual(16)
  })
})

describe('room codes', () => {
  it('avoids characters that read as each other across a table', () => {
    for (let i = 0; i < 200; i++) {
      const code = makeRoomCode()
      expect(code).toHaveLength(4)
      expect(code).not.toMatch(/[IO01]/)
    }
  })

  it('forgives however someone types the code in', () => {
    expect(normaliseRoomCode(' a b-2x ')).toBe('AB2X')
    expect(normaliseRoomCode('abcdefgh')).toBe('ABCD')
  })
})

describe('the lobby', () => {
  it('seats the host first and everyone else in the order they arrive', () => {
    const { room } = makeRoom(NAMES)
    expect(room.roster.map((m) => [m.seat, m.name])).toEqual([
      [0, 'Ada'],
      [1, 'Bo'],
      [2, 'Cai'],
      [3, 'Dee'],
      [4, 'Eve'],
    ])
  })

  it('will not deal without enough players, or with too many', () => {
    const { room, tokens } = makeRoom(['Ada', 'Bo', 'Cai'])
    expect(room.viewFor(tokens[0]).canStart).toBe(false)
    expect(() => room.handle(tokens[0], { t: 'start' })).toThrow(/4–8/)

    const big = makeRoom(NAMES.concat(['Fay', 'Gus', 'Hal']))
    expect(() => big.room.join('peer-9', 'token-9', 'Ivy')).toThrow(/full/)
  })

  it('frees a seat when someone leaves before the deal, but holds it after', () => {
    const { room } = makeRoom(NAMES)
    room.leave('peer-4')
    expect(room.roster).toHaveLength(4)

    const full = makeRoom(NAMES)
    full.room.handle(full.tokens[0], { t: 'start' })
    full.room.leave('peer-4')
    expect(full.room.roster).toHaveLength(5)
    expect(full.room.viewFor(full.tokens[4]).you?.seat).toBe(4)
  })

  it('puts a returning phone back in its own seat, mid-round', () => {
    const { room, tokens } = makeRoom(NAMES)
    const before = room.viewFor(tokens[3])
    room.handle(tokens[0], { t: 'start' })
    const card = room.viewFor(tokens[3]).secret

    room.leave('peer-3')
    expect(room.viewFor(tokens[3]).players[3].connected).toBe(false)

    const back = room.join('peer-3-again', tokens[3], 'Dee')
    expect(back.seat).toBe(before.you?.seat)
    expect(room.viewFor(tokens[3]).secret).toEqual(card)
    expect(room.viewFor(tokens[3]).players[3].connected).toBe(true)
  })

  it('turns away a newcomer once the cards are out', () => {
    const { room, tokens } = makeRoom(NAMES)
    room.handle(tokens[0], { t: 'start' })
    expect(() => room.join('peer-late', 'token-late', 'Late')).toThrow(/already started/)
  })

  it('keeps host-only controls to the host', () => {
    const { room, tokens } = makeRoom(NAMES)
    expect(() => room.handle(tokens[2], { t: 'start' })).toThrow(/only the host/)
    room.handle(tokens[0], { t: 'start' })
    expect(() => room.handle(tokens[2], { t: 'advance' })).toThrow(/only the host/)
    expect(() => room.handle(tokens[2], { t: 'again' })).toThrow(/only the host/)
  })
})

describe('what crosses the wire', () => {
  it('sends each phone its own card and nobody else’s', () => {
    const { room, tokens } = makeRoom(NAMES)
    room.handle(tokens[0], { t: 'start' })
    const game = room.state as GameState

    tokens.forEach((token, seat) => {
      const view = room.viewFor(token)
      const self = game.players[seat]
      expect(view.secret).toEqual({
        role: self.role,
        dice: self.dice,
        chosenDie: self.chosenDie,
      })
      // Roles and dice appear only in this player's own corner of the view.
      for (const path of secretKeyPaths(view)) {
        expect(path.startsWith('secret.') || path.startsWith('night.')).toBe(true)
      }
      expect(view.players.every((p) => !('role' in p) && !('dice' in p))).toBe(true)
    })
  })

  it('tells a phone nothing about the night until its hour is called', () => {
    const nowRef = { t: 0 }
    const { room, tokens } = makeRoom(NAMES, nowRef)
    room.handle(tokens[0], { t: 'start' })
    for (const token of tokens) {
      room.handle(token, { t: 'action', action: { type: 'ready', playerId: seatOf(room, token) } })
    }

    const game = () => room.state as GameState
    expect(game().phase).toBe('night')

    for (const hour of HOURS) {
      expect(game().nightHour).toBe(hour)
      tokens.forEach((token, seat) => {
        const view = room.viewFor(token)
        const hours = wakeHoursOf(game().players[seat], game().preset)
        const shouldKnow = hours.some((h) => h <= hour)
        expect(view.night === null).toBe(!shouldKnow)
        if (view.night) {
          expect(view.night.playerId).toBe(`p${seat}`)
          // Never a waking that has not happened yet.
          expect(view.night.hours.every((h) => h <= hour)).toBe(true)
        }
      })
      nowRef.t += HOUR_MS
      room.tick()
    }
    expect(game().phase).toBe('discussion')
  })

  it('offers the thief their witnesses only at the moment of the theft', () => {
    const nowRef = { t: 0 }
    const { room, tokens } = makeRoom(NAMES, nowRef)
    room.handle(tokens[0], { t: 'start' })
    for (const token of tokens) {
      room.handle(token, { t: 'action', action: { type: 'ready', playerId: seatOf(room, token) } })
    }
    const game = () => room.state as GameState
    const thiefToken = tokens[Number(game().thiefId.slice(1))]

    let offered = 0
    for (const _ of HOURS) {
      const view = room.viewFor(thiefToken)
      if (view.witnesses.length > 0) {
        offered += 1
        expect(view.pending).toBe('accomplices')
        expect(pendingChoiceFor(game(), game().thiefId)).toBe('accomplices')
      }
      // No other phone is ever shown the witness list.
      for (const token of tokens.filter((t) => t !== thiefToken)) {
        expect(room.viewFor(token).witnesses).toEqual([])
      }
      nowRef.t += HOUR_MS
      room.tick()
    }
    expect(offered).toBeLessThanOrEqual(1)
  })

  it('never lets the night say who is awake', () => {
    const nowRef = { t: 0 }
    const { room, tokens } = makeRoom(NAMES, nowRef)
    room.handle(tokens[0], { t: 'start' })
    tokens.forEach((token) => {
      room.handle(token, { t: 'action', action: { type: 'ready', playerId: seatOf(room, token) } })
    })
    const game = () => room.state as GameState

    while (game().phase === 'night') {
      // Everyone awake finishes, which is the worst case for leaking.
      for (const id of pendingPlayers(game())) {
        if (pendingChoiceFor(game(), id) === null) {
          room.handle(tokens[Number(id.slice(1))], {
            t: 'action',
            action: { type: 'ready', playerId: id },
          })
        }
      }

      for (const token of tokens) {
        const view = room.viewFor(token)
        // Naming who the room waits on would name who is up.
        expect(view.waitingOn).toEqual([])
        // And so would a readiness flag on anybody else's row.
        for (const player of view.players) {
          if (player.id !== view.you?.id) expect(player.ready).toBe(false)
        }
      }
      nowRef.t += HOUR_MS
      room.tick()
    }

    // By day it is fair game again: everyone votes, so it gives nothing away.
    room.handle(tokens[0], { t: 'advance' })
    expect(room.viewFor(tokens[0]).waitingOn).toHaveLength(NAMES.length)
  })

  it('keeps the result to itself until the votes are in', () => {
    const nowRef = { t: 0 }
    const { room, tokens } = makeRoom(NAMES, nowRef)
    room.handle(tokens[0], { t: 'start' })
    const game = () => room.state as GameState

    const noneKnowYet = () =>
      tokens.every((token) => room.viewFor(token).outcome === null)

    expect(noneKnowYet()).toBe(true)
    tokens.forEach((token) => {
      room.handle(token, { t: 'action', action: { type: 'ready', playerId: seatOf(room, token) } })
    })
    while (game().phase === 'night') {
      expect(noneKnowYet()).toBe(true)
      nowRef.t += HOUR_MS
      room.tick()
    }
    expect(noneKnowYet()).toBe(true)

    room.handle(tokens[0], { t: 'advance' }) // discussion → vote
    tokens.forEach((token, seat) => {
      expect(noneKnowYet()).toBe(true)
      room.handle(token, {
        t: 'action',
        action: { type: 'castVote', playerId: `p${seat}`, targetId: `p${(seat + 1) % 5}` },
      })
    })

    expect(game().phase).toBe('results')
    expect(tokens.every((token) => room.viewFor(token).outcome !== null)).toBe(true)
  })
})

describe('acting', () => {
  it('lets a phone act only for the person holding it', () => {
    const { room, tokens } = makeRoom(NAMES)
    room.handle(tokens[0], { t: 'start' })
    expect(() =>
      room.handle(tokens[2], { t: 'action', action: { type: 'ready', playerId: 'p0' } }),
    ).toThrow(/only act for yourself/)
  })

  it('refuses a 共犯 designation from anyone but the thief', () => {
    const { room, tokens } = makeRoom(NAMES)
    room.handle(tokens[0], { t: 'start' })
    const game = room.state as GameState
    const notThief = tokens.find((_, seat) => `p${seat}` !== game.thiefId)!
    expect(() =>
      room.handle(notThief, { t: 'action', action: { type: 'designateAccomplices', ids: [] } }),
    ).toThrow(/only the thief/)
  })

  it('refuses host controls smuggled in as a player action', () => {
    const { room, tokens } = makeRoom(NAMES)
    room.handle(tokens[0], { t: 'start' })
    expect(() =>
      room.handle(tokens[2], { t: 'action', action: { type: 'advance' } }),
    ).toThrow(/host/)
    expect(() =>
      room.handle(tokens[2], {
        t: 'action',
        action: { type: 'setTieRule', tieRule: 'thiefWins' },
      }),
    ).toThrow(/host/)
  })

  it('opens the night by itself once every phone has seen its card', () => {
    const { room, tokens } = makeRoom(NAMES)
    room.handle(tokens[0], { t: 'start' })
    expect((room.state as GameState).phase).toBe('reveal')
    tokens.forEach((token) => {
      room.handle(token, { t: 'action', action: { type: 'ready', playerId: seatOf(room, token) } })
    })
    expect((room.state as GameState).phase).toBe('night')
    expect((room.state as GameState).nightHour).toBe(1)
  })
})

describe('the night’s clock', () => {
  it('gives every hour the same length, awake or not', () => {
    const nowRef = { t: 0 }
    const { room, tokens } = makeRoom(NAMES, nowRef)
    room.handle(tokens[0], { t: 'start' })
    tokens.forEach((token) => {
      room.handle(token, { t: 'action', action: { type: 'ready', playerId: seatOf(room, token) } })
    })

    const game = () => room.state as GameState
    for (const hour of HOURS) {
      expect(game().nightHour).toBe(hour)
      // Everyone awake finishing early buys the table nothing.
      for (const id of pendingPlayers(game())) {
        if (pendingChoiceFor(game(), id) === null) {
          room.handle(tokens[Number(id.slice(1))], {
            t: 'action',
            action: { type: 'ready', playerId: id },
          })
        }
      }
      expect(game().nightHour).toBe(hour)
      nowRef.t += HOUR_MS - 1
      expect(room.tick()).toBe(false)
      nowRef.t += 1
      expect(room.tick()).toBe(true)
    }
    expect(game().phase).toBe('discussion')
  })

  it('stops the clock outside the night', () => {
    const nowRef = { t: 0 }
    const { room, tokens } = makeRoom(NAMES, nowRef)
    room.handle(tokens[0], { t: 'start' })
    expect(room.viewFor(tokens[0]).hourEndsAt).toBeNull()
    expect(room.tick()).toBe(false)
  })
})

describe('a whole networked round', () => {
  it('reaches a result, and leaks nothing along the way', () => {
    const nowRef = { t: 0 }
    const { room, tokens } = makeRoom(NAMES, nowRef)
    room.handle(tokens[0], { t: 'start' })

    const game = () => room.state as GameState
    const seen: ClientView[] = []
    const snapshot = () => tokens.forEach((t) => seen.push(room.viewFor(t)))

    snapshot()
    tokens.forEach((token) => {
      room.handle(token, { t: 'action', action: { type: 'ready', playerId: seatOf(room, token) } })
    })

    while (game().phase === 'night') {
      snapshot()
      for (const id of pendingPlayers(game())) {
        const token = tokens[Number(id.slice(1))]
        if (pendingChoiceFor(game(), id) === 'accomplices') {
          const view = room.viewFor(token)
          room.handle(token, {
            t: 'action',
            action: {
              type: 'designateAccomplices',
              ids: view.witnesses.slice(0, view.accompliceSlots).map((w) => w.id),
            },
          })
        }
        if (pendingChoiceFor(game(), id) === null) {
          room.handle(token, { t: 'action', action: { type: 'ready', playerId: id } })
        }
      }
      nowRef.t += HOUR_MS
      room.tick()
    }

    expect(game().phase).toBe('discussion')
    snapshot()
    room.handle(tokens[0], { t: 'advance' })
    expect(game().phase).toBe('vote')

    snapshot()
    tokens.forEach((token, seat) => {
      room.handle(token, {
        t: 'action',
        action: {
          type: 'castVote',
          playerId: `p${seat}`,
          targetId: `p${(seat + 1) % tokens.length}`,
        },
      })
    })

    expect(game().phase).toBe('results')
    const finalViews = tokens.map((t) => room.viewFor(t))
    for (const view of finalViews) expect(view.outcome).not.toBeNull()

    // Nothing sent before the reveal ever carried anyone else's secrets.
    for (const view of seen) {
      expect(view.outcome).toBeNull()
      for (const path of secretKeyPaths(view)) {
        expect(path.startsWith('secret.') || path.startsWith('night.')).toBe(true)
      }
      if (view.night) expect(view.night.playerId).toBe(view.you?.id)
    }
  })

  it('deals a fresh round to the same table on “again”', () => {
    let seed = 1
    const room = new Room({
      code: 'TEST',
      hostToken: 'h',
      hostName: 'Ada',
      rules: { tieRule: 'sleepyheadsWin', useScapegoat: true, voteStyle: 'secret' },
      seed: () => seed++,
    })
    NAMES.slice(1).forEach((n, i) => room.join(`peer-${i}`, `t${i}`, n))
    room.handle('h', { t: 'start' })
    const first = (room.state as GameState).thiefId
    const firstDice = (room.state as GameState).players.map((p) => p.dice.join())

    room.handle('h', { t: 'again' })
    const second = room.state as GameState
    expect(second.phase).toBe('reveal')
    expect(second.players.map((p) => p.name)).toEqual(NAMES)
    expect([second.thiefId !== first, second.players.map((p) => p.dice.join()) !== firstDice])
      .toContain(true)
  })
})

function seatOf(room: Room, token: string): PlayerId {
  const seat = room.roster.find((m) => m.token === token)?.seat ?? 0
  return `p${seat}`
}

