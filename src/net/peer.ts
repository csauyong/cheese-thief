import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'

import type { ClientView } from './protocol'
import { PROTOCOL_VERSION } from './protocol'
import type { ClientMessage, ServerMessage } from './protocol'
import { Room } from './room'
import type { RoomOptions } from './room'

/**
 * WebRTC plumbing, over the public PeerJS broker.
 *
 * There is no server of ours anywhere in this: the broker only introduces two
 * browsers to each other, and from then on the phones talk directly. That is
 * what keeps the whole thing a static page on GitHub Pages — and it is also why
 * the host's tab is the game. Close it and the room is gone.
 *
 * Peer ids are derived from the room code, so a four-character code typed across
 * a table is enough to find the right room.
 */
const PEER_PREFIX = 'cheese-thief-v1-'

/**
 * Which broker to introduce peers through.
 *
 * Empty means PeerJS's public cloud, which is what a normal build uses. Pointing
 * it at your own is a build-time escape hatch: handy if the public broker is
 * ever down or blocked on your network, and it is how the end-to-end test drives
 * four real browsers through a real WebRTC connection without leaving the machine.
 */
function brokerOptions(): { host?: string; port?: number; path?: string; secure?: boolean; config?: RTCConfiguration } {
  const host = import.meta.env.VITE_PEER_HOST
  if (!host) return {}
  return {
    host,
    port: Number(import.meta.env.VITE_PEER_PORT ?? 9000),
    path: import.meta.env.VITE_PEER_PATH ?? '/',
    secure: import.meta.env.VITE_PEER_SECURE === 'true',
    // A self-hosted broker is normally a LAN one, where host candidates connect
    // directly and a public STUN lookup only adds a timeout.
    config: { iceServers: [] },
  }
}

export function peerIdForRoom(code: string): string {
  return `${PEER_PREFIX}${code.toUpperCase()}`
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error'

export interface HostHandle {
  room: Room
  /** The host's own view, refreshed whenever anything changes. */
  view: () => ClientView
  send: (message: ClientMessage) => void
  status: () => ConnectionStatus
  close: () => void
}

export interface HostOptions extends RoomOptions {
  onChange: () => void
  onStatus: (status: ConnectionStatus, detail?: string) => void
}

/**
 * Open a room and keep it running.
 *
 * The host is a player too: their own actions go straight into the room rather
 * than over the wire, and everyone else's arrive as messages.
 */
export function hostRoom(options: HostOptions): HostHandle {
  const { onChange, onStatus, ...roomOptions } = options
  const room = new Room(roomOptions)
  const connections = new Map<string, DataConnection>()
  const tokensByPeer = new Map<string, string>()
  let status: ConnectionStatus = 'connecting'

  const peer = new Peer(peerIdForRoom(room.code), { debug: 0, ...brokerOptions() })

  const setStatus = (next: ConnectionStatus, detail?: string) => {
    status = next
    onStatus(next, detail)
  }

  const push = () => {
    for (const { peerId, view } of room.views()) {
      const connection = connections.get(peerId)
      if (connection?.open) connection.send({ t: 'view', view } satisfies ServerMessage)
    }
    onChange()
  }

  peer.on('open', () => setStatus('open'))
  peer.on('error', (error) => setStatus('error', error.message))
  peer.on('disconnected', () => {
    setStatus('connecting')
    // A dropped broker connection does not kill live data channels, but without
    // it nobody new can join — so try to get it back.
    peer.reconnect()
  })

  peer.on('connection', (connection) => {
    connections.set(connection.peer, connection)

    connection.on('data', (raw) => {
      const message = raw as ClientMessage
      try {
        if (message.t === 'hello') {
          if (message.v !== PROTOCOL_VERSION) {
            throw new Error('that phone is running a different version of the game')
          }
          room.join(connection.peer, message.token, message.name)
          tokensByPeer.set(connection.peer, message.token)
        } else {
          const token = tokensByPeer.get(connection.peer)
          if (!token) throw new Error('say hello first')
          room.handle(token, message)
        }
        push()
      } catch (error) {
        connection.send({
          t: 'error',
          message: error instanceof Error ? error.message : String(error),
        } satisfies ServerMessage)
      }
    })

    connection.on('close', () => {
      connections.delete(connection.peer)
      room.leave(connection.peer)
      push()
    })
    connection.on('error', () => {
      connections.delete(connection.peer)
      room.leave(connection.peer)
      push()
    })
  })

  // The night's clock. Checked often enough that the countdown on every phone
  // stays honest without the host's tab working hard.
  const timer = window.setInterval(() => {
    if (room.tick()) push()
  }, 250)

  return {
    room,
    view: () => room.viewFor(room.hostToken),
    send: (message) => {
      room.handle(room.hostToken, message)
      push()
    },
    status: () => status,
    close: () => {
      window.clearInterval(timer)
      for (const connection of connections.values()) connection.close()
      peer.destroy()
      setStatus('closed')
    },
  }
}

export interface ClientHandle {
  send: (message: ClientMessage) => void
  status: () => ConnectionStatus
  close: () => void
}

export interface ClientOptions {
  code: string
  token: string
  name: string
  onView: (view: ClientView) => void
  onStatus: (status: ConnectionStatus, detail?: string) => void
  onError: (message: string) => void
}

/** Join someone else's room. */
export function joinRoom(options: ClientOptions): ClientHandle {
  let status: ConnectionStatus = 'connecting'
  const setStatus = (next: ConnectionStatus, detail?: string) => {
    status = next
    options.onStatus(next, detail)
  }

  const peer = new Peer({ debug: 0, ...brokerOptions() })
  let connection: DataConnection | null = null

  peer.on('open', () => {
    connection = peer.connect(peerIdForRoom(options.code), { reliable: true })

    connection.on('open', () => {
      setStatus('open')
      connection?.send({
        t: 'hello',
        v: PROTOCOL_VERSION,
        token: options.token,
        name: options.name,
      } satisfies ClientMessage)
    })

    connection.on('data', (raw) => {
      const message = raw as ServerMessage
      if (message.t === 'view') options.onView(message.view)
      else if (message.t === 'error') options.onError(message.message)
    })

    connection.on('close', () => setStatus('closed'))
    connection.on('error', (error) => setStatus('error', error.message))
  })

  peer.on('error', (error) => {
    // The broker says this id is unknown when the room code is wrong or the
    // host has gone — by far the most likely thing to go wrong, so name it.
    const detail =
      error.type === 'peer-unavailable' ? 'no room with that code' : error.message
    setStatus('error', detail)
  })

  return {
    send: (message) => {
      if (connection?.open) connection.send(message)
    },
    status: () => status,
    close: () => {
      connection?.close()
      peer.destroy()
      setStatus('closed')
    },
  }
}
