import type { ClientView, ConnectionStatus } from '../../net'
import { useT } from '../../i18n'
import { QrCode } from '../components/QrCode'

/** Shown to everyone while the table fills up. */
export function LiveLobby({
  view,
  status,
  isHost,
  joinUrl,
  onStart,
  onLeave,
  onCopy,
  copied,
}: {
  view: ClientView
  status: ConnectionStatus
  isHost: boolean
  joinUrl: string
  onStart: () => void
  onLeave: () => void
  onCopy: () => void
  copied: boolean
}) {
  const { t } = useT()

  return (
    <>
      <div className="row">
        <h2 className="spacer">{t('live.roomCode', { code: view.code })}</h2>
        <StatusPill status={status} />
      </div>

      {isHost && (
        <div className="card center stack">
          <QrCode text={joinUrl} size={196} />
          <p className="muted small">{t('live.scanToJoin')}</p>
          <div className="code-big">{view.code}</div>
          <button className="btn small ghost block" onClick={onCopy}>
            {copied ? t('live.copied') : t('live.copyLink')}
          </button>
        </div>
      )}

      <div className="card">
        <h3>{t('live.playersIn', { n: view.players.length })}</h3>
        <div className="stack-sm">
          {view.players.map((player) => (
            <div className="row" key={player.id}>
              <span>{player.name}</span>
              {player.seat === 0 && <span className="tag">{t('live.hostTag')}</span>}
              {player.id === view.you?.id && <span className="tag accomplice">{t('live.youTag')}</span>}
              <span className="spacer" />
              {!player.connected && <span className="tag">{t('live.offline')}</span>}
            </div>
          ))}
        </div>
        {!view.canStart && <p className="muted small">{t('live.needMore')}</p>}
      </div>

      {isHost ? (
        <>
          <button className="btn primary block" disabled={!view.canStart} onClick={onStart}>
            {t('live.start')}
          </button>
          <p className="muted small center">{t('live.hostWarning')}</p>
        </>
      ) : (
        <p className="muted center">{t('live.waiting')}</p>
      )}

      <button className="btn block ghost" onClick={onLeave}>
        {t('live.leave')}
      </button>
    </>
  )
}

export function StatusPill({ status }: { status: ConnectionStatus }) {
  const { t } = useT()
  return (
    <span className={`tag status-${status}`}>
      {t(`live.status.${status}` as `live.status.${ConnectionStatus}`)}
    </span>
  )
}
