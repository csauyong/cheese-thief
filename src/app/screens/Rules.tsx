import type { DictKey } from '../../i18n'
import { useT } from '../../i18n'

const SECTIONS: Array<[DictKey, DictKey]> = [
  ['rules.setupTitle', 'rules.setup'],
  ['rules.nightTitle', 'rules.night'],
  ['rules.dayTitle', 'rules.day'],
  ['rules.winTitle', 'rules.win'],
  ['rules.countsTitle', 'rules.counts'],
  ['rules.appTitle', 'rules.app'],
]

export function Rules({ onBack }: { onBack: () => void }) {
  const { t, tl } = useT()
  return (
    <>
      <div className="row">
        <button className="btn small ghost" onClick={onBack}>
          {t('common.back')}
        </button>
        <h2 className="spacer">{t('rules.title')}</h2>
      </div>

      <div className="card">
        <h3>{t('rules.storyTitle')}</h3>
        <p className="muted">{t('rules.story')}</p>
      </div>

      {SECTIONS.map(([titleKey, bodyKey]) => (
        <div className="card" key={titleKey}>
          <h3>{t(titleKey)}</h3>
          <ul>
            {tl(bodyKey).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}

      <p className="muted small center">{t('app.unofficial')}</p>

      <button className="btn block ghost" onClick={onBack}>
        {t('rules.back')}
      </button>
    </>
  )
}
