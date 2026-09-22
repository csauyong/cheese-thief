import type { DictKey } from '../../i18n'
import { useT } from '../../i18n'
import { QuitButton } from './QuitButton'

export function PhaseHeader({
  titleKey,
  progressKey,
  seat,
  players,
  onQuit,
}: {
  titleKey: DictKey
  progressKey?: DictKey
  seat?: number
  players?: number
  onQuit: () => void
}) {
  const { t } = useT()
  return (
    <div className="row">
      <h2 className="spacer">{t(titleKey)}</h2>
      {progressKey && seat !== undefined && players !== undefined && (
        <span className="progress">{t(progressKey, { i: seat + 1, n: players })}</span>
      )}
      <QuitButton onQuit={onQuit} />
    </div>
  )
}
