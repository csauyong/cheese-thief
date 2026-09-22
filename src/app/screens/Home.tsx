import { useT } from '../../i18n'

export function Home({
  hasGame,
  onNew,
  onResume,
  onRules,
  onScoreboard,
}: {
  hasGame: boolean
  onNew: () => void
  onResume: () => void
  onRules: () => void
  onScoreboard: () => void
}) {
  const { t } = useT()
  return (
    <>
      <div className="card center stack">
        <h1>{t('app.name')}</h1>
        <p className="muted">{t('app.subtitle')}</p>
      </div>

      <div className="stack">
        {hasGame && (
          <button className="btn primary block" onClick={onResume}>
            {t('home.continue')}
          </button>
        )}
        <button className={`btn block${hasGame ? '' : ' primary'}`} onClick={onNew}>
          {t('home.newGame')}
        </button>
        <button className="btn block" onClick={onRules}>
          {t('home.rules')}
        </button>
        <button className="btn block" onClick={onScoreboard}>
          {t('home.scoreboard')}
        </button>
      </div>

      <p className="muted small center">{t('app.unofficial')}</p>
    </>
  )
}
