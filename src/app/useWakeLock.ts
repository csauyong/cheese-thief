import { useEffect } from 'react'

type WakeLockSentinel = { release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
}

/**
 * Keep the screen awake while a round is in progress. A phone that locks itself
 * halfway round the table is a small disaster: somebody has to unlock it, and
 * whoever does is looking at someone else's screen.
 *
 * Entirely best-effort — unsupported browsers and refused requests are fine.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const nav = navigator as WakeLockNavigator
    if (!nav.wakeLock) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // Denied or unsupported. The game plays fine either way.
      }
    }

    // The lock is dropped whenever the tab is hidden, so take it again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [active])
}
