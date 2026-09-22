import { useMemo, useState } from 'react'

import type { RulesConfig } from '../../engine'
import { useT } from '../../i18n'
import { makeRoomCode, normaliseRoomCode, roomCodeFromUrl } from '../../net'
import { loadSetup } from '../../store/scoreboard'
import { LiveLobby, StatusPill } from './LiveLobby'
import { LiveRound } from './LiveRound'
import type { LiveConfig } from './useLiveSession'
import { useLiveSession } from './useLiveSession'

const DEFAULT_RULES: RulesConfig = {
  tieRule: 'sleepyheadsWin',
  useScapegoat: true,
  voteStyle: 'secret',
}

export function Live({ onBack }: { onBack: () => void }) {
  const { t } = useT()
  const [config, setConfig] = useState<LiveConfig | null>(null)
  const [copied, setCopied] = useState(false)

  if (!config) return <LiveEntry onBack={onBack} onGo={setConfig} />

  return (
    <LiveRoomScreen
      config={config}
      copied={copied}
      onCopied={setCopied}
      onLeave={() => {
        setConfig(null)
        setCopied(false)
        onBack()
      }}
      retryLabel={t('live.retry')}
    />
  )
}

function LiveEntry({
  onBack,
  onGo,
}: {
  onBack: () => void
  onGo: (config: LiveConfig) => void
}) {
  const { t } = useT()
  const remembered = useMemo(loadSetup, [])
  const [name, setName] = useState(() => remembered?.names?.[0] ?? '')
  const [code, setCode] = useState(roomCodeFromUrl)
  const trimmed = name.trim()

  return (
    <>
      <div className="row">
        <button className="btn small ghost" onClick={onBack}>
          {t('common.back')}
        </button>
        <h2 className="spacer">{t('live.title')}</h2>
      </div>

      <div className="card">
        <h3>{t('live.yourName')}</h3>
        <input
          type="text"
          value={name}
          placeholder={t('live.namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <button
        className="btn primary block"
        disabled={!trimmed}
        onClick={() =>
          onGo({ kind: 'host', code: makeRoomCode(), name: trimmed, rules: DEFAULT_RULES })
        }
      >
        {t('live.host')}
      </button>

      <div className="card">
        <h3>{t('live.join')}</h3>
        <div className="row">
          <input
            type="text"
            value={code}
            placeholder={t('live.codePlaceholder')}
            inputMode="text"
            autoCapitalize="characters"
            onChange={(e) => setCode(normaliseRoomCode(e.target.value))}
            style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.25em' }}
          />
          <button
            className="btn"
            disabled={!trimmed || code.length !== 4}
            onClick={() => onGo({ kind: 'join', code, name: trimmed })}
          >
            {t('live.go')}
          </button>
        </div>
      </div>
    </>
  )
}

function LiveRoomScreen({
  config,
  copied,
  onCopied,
  onLeave,
  retryLabel,
}: {
  config: LiveConfig
  copied: boolean
  onCopied: (copied: boolean) => void
  onLeave: () => void
  retryLabel: string
}) {
  const { t } = useT()
  const session = useLiveSession(config)
  const { view, status, detail, error, clearError, send } = session

  const joinUrl = useMemo(() => {
    const url = new URL(window.location.href)
    url.search = `?room=${config.code}`
    url.hash = ''
    return url.toString()
  }, [config.code])

  if (!view) {
    return (
      <>
        <div className="row">
          <h2 className="spacer">{t('live.title')}</h2>
          <StatusPill status={status} />
        </div>
        <div className="card center stack">
          <p className="muted">{t(`live.status.${status}`)}</p>
          {status === 'error' && (
            <p className="error">
              {detail === 'no room with that code' ? t('live.errorNoRoom') : detail}
            </p>
          )}
          <button className="btn block ghost" onClick={onLeave}>
            {status === 'error' ? retryLabel : t('live.leave')}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {error && (
        <div className="card" role="alert">
          <p className="error">{error}</p>
          <button className="btn small ghost" onClick={clearError}>
            {t('common.confirm')}
          </button>
        </div>
      )}

      {view.stage === 'lobby' ? (
        <LiveLobby
          view={view}
          status={status}
          isHost={config.kind === 'host'}
          joinUrl={joinUrl}
          copied={copied}
          onCopy={() => {
            void navigator.clipboard?.writeText(joinUrl).then(
              () => onCopied(true),
              () => onCopied(false),
            )
          }}
          onStart={() => send({ t: 'start' })}
          onLeave={onLeave}
        />
      ) : (
        <LiveRound view={view} send={send} onLeave={onLeave} />
      )}
    </>
  )
}
