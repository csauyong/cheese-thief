/**
 * A tiny seeded PRNG (mulberry32). Every game is reproducible from its seed,
 * which is what lets the tests pin down awkward deals — three mice awake on the
 * thief's hour, a 背鍋鼠 tying for top vote — instead of hoping for them.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [0, n). */
  int(n: number): number
  /** Fisher–Yates, returns a new array. */
  shuffle<T>(items: readonly T[]): T[]
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (n: number): number => Math.floor(next() * n)
  return {
    next,
    int,
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1)
        const tmp = out[i]
        out[i] = out[j]
        out[j] = tmp
      }
      return out
    },
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}
