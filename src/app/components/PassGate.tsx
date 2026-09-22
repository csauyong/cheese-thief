import { useT } from '../../i18n'

/**
 * The handoff card. Nothing secret is on screen, so it is safe for the phone to
 * be in mid-air — which is the point.
 */
export function PassGate({ name, onReady }: { name: string; onReady: () => void }) {
  const { t } = useT()
  return (
    <div className="card accent center stack">
      <h2>{t('pass.handTo', { name })}</h2>
      <p className="muted small">{t('pass.privacy', { name })}</p>
      <button className="btn primary block" onClick={onReady}>
        {t('pass.confirm', { name })}
      </button>
    </div>
  )
}
