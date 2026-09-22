/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Self-hosted PeerJS broker; empty uses the public cloud. See src/net/peer.ts. */
  readonly VITE_PEER_HOST?: string
  readonly VITE_PEER_PORT?: string
  readonly VITE_PEER_PATH?: string
  readonly VITE_PEER_SECURE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
