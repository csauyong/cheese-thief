import { useCallback, useEffect, useRef, useState } from 'react'

import type { RulesConfig } from '../../engine'
import type { ClientMessage, ClientView, ConnectionStatus } from '../../net'
import { hostRoom, joinRoom, makeToken } from '../../net'
import { readJson, writeJson } from '../../store/storage'

const TOKEN_KEY = 'cheese-thief:token'

/**
 * A stable identity for this browser, so a refresh or a lost signal drops the
 * player back into their own seat rather than stranding them outside a room
 * that has already been dealt.
 */
export function playerToken(): string {
  const existing = readJson<string | null>(TOKEN_KEY, null)
  if (existing) return existing
  const token = makeToken()
  writeJson(TOKEN_KEY, token)
  return token
}

export interface LiveSession {
  view: ClientView | null
  status: ConnectionStatus
  detail: string | null
  error: string | null
  send: (message: ClientMessage) => void
  clearError: () => void
}

export interface HostConfig {
  kind: 'host'
  code: string
  name: string
  rules: RulesConfig
}

export interface JoinConfig {
  kind: 'join'
  code: string
  name: string
}

export type LiveConfig = HostConfig | JoinConfig

/**
 * Runs one side of a networked room for as long as the screen is mounted.
 *
 * Hosting and joining differ in almost everything except what the rest of the
 * app wants from them — a view to render and somewhere to send actions — so they
 * are the same hook, and every screen below here is written once.
 */
export function useLiveSession(config: LiveConfig | null): LiveSession {
  const [view, setView] = useState<ClientView | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [detail, setDetail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sendRef = useRef<(message: ClientMessage) => void>(() => {})

  useEffect(() => {
    if (!config) return
    const token = playerToken()
    let closed = false

    if (config.kind === 'host') {
      const handle = hostRoom({
        code: config.code,
        hostToken: token,
        hostName: config.name,
        rules: config.rules,
        onChange: () => {
          if (!closed) setView(handle.view())
        },
        onStatus: (next, why) => {
          if (closed) return
          setStatus(next)
          setDetail(why ?? null)
        },
      })
      sendRef.current = (message) => {
        try {
          handle.send(message)
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
      setView(handle.view())
      return () => {
        closed = true
        handle.close()
      }
    }

    const handle = joinRoom({
      code: config.code,
      token,
      name: config.name,
      onView: (next) => {
        if (!closed) setView(next)
      },
      onStatus: (next, why) => {
        if (closed) return
        setStatus(next)
        setDetail(why ?? null)
      },
      onError: (message) => {
        if (!closed) setError(message)
      },
    })
    sendRef.current = handle.send
    return () => {
      closed = true
      handle.close()
    }
  }, [config])

  const send = useCallback((message: ClientMessage) => sendRef.current(message), [])
  const clearError = useCallback(() => setError(null), [])

  return { view, status, detail, error, send, clearError }
}
