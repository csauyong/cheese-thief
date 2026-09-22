import { useT } from '../../i18n'

/** Abandoning a dealt round loses it, so it asks first. */
export function QuitButton({ onQuit }: { onQuit: () => void }) {
  const { t } = useT()
  return (
    <button
      className="btn small ghost"
      onClick={() => {
        if (window.confirm(t('common.quitConfirm'))) onQuit()
      }}
    >
      {t('common.quit')}
    </button>
  )
}
