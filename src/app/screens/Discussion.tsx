import type { GameState } from '../../engine'
import { applyAction } from '../../engine'
import { useT } from '../../i18n'
import { PhaseHeader } from '../components/PhaseHeader'

/**
 * The app has nothing to police here — the one restriction (no lifting your
 * 骰盅, no turning your card) is physical, and the phone simply reminds the
 * table of it before getting out of the way.
 */
export function Discussion({
  game,
  setGame,
  onQuit,
}: {
  game: GameState
  setGame: (state: GameState) => void
  onQuit: () => void
}) {
  const { t, tl } = useT()
  return (
    <>
      <PhaseHeader titleKey="discussion.title" onQuit={onQuit} />

      <div className="card accent center">
        <h1>{t('discussion.lead')}</h1>
      </div>

      <div className="card">
        <h3>{t('discussion.ruleTitle')}</h3>
        <p>{t('discussion.rule')}</p>
      </div>

      <div className="card quiet">
        <h3>{t('discussion.promptTitle')}</h3>
        <ul className="muted">
          {tl('discussion.prompts').map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      </div>

      <button
        className="btn primary block"
        onClick={() => setGame(applyAction(game, { type: 'advance' }))}
      >
        {t('discussion.toVote')}
      </button>
    </>
  )
}
