import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { useT } from '../../i18n'

/**
 * Secret information stays hidden until a finger is held on it, and vanishes the
 * moment the finger lifts. On a phone in the middle of a table that matters more
 * than it sounds: a card left face-up while someone reaches for their drink is
 * exactly how a round gets spoiled.
 *
 * `onFirstReveal` fires once, and screens use it to unlock any choice the player
 * has to make — there is no point offering a pick before they have looked.
 */
export function HoldToReveal({
  children,
  onFirstReveal,
}: {
  children: ReactNode
  onFirstReveal?: () => void
}) {
  const { t } = useT()
  const [held, setHeld] = useState(false)
  const seen = useRef(false)

  const open = useCallback(() => {
    setHeld(true)
    if (!seen.current) {
      seen.current = true
      onFirstReveal?.()
    }
  }, [onFirstReveal])

  const close = useCallback(() => setHeld(false), [])

  // A pointer released outside the element never sends pointerup to it.
  useEffect(() => {
    if (!held) return
    window.addEventListener('pointerup', close)
    window.addEventListener('pointercancel', close)
    return () => {
      window.removeEventListener('pointerup', close)
      window.removeEventListener('pointercancel', close)
    }
  }, [held, close])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    open()
  }

  return (
    <div
      className={`hold${held ? ' open' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={held}
      aria-label={t('pass.hold')}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') close()
      }}
      onBlur={close}
    >
      {held ? (
        <div className="hold-body">{children}</div>
      ) : (
        <div className="hold-prompt">
          <strong>{t('pass.hold')}</strong>
          <span className="small">{t('pass.holdHint')}</span>
        </div>
      )}
    </div>
  )
}
