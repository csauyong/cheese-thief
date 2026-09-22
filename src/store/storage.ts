/**
 * Everything here is a convenience, never a source of truth for a round in
 * progress. Storage can be blocked (private windows, locked-down browsers), so
 * every read and write is wrapped and every reader has a sane fallback.
 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Nothing to do — the round still plays, it just will not be remembered.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // As above.
  }
}
