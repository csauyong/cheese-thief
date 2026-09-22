import { useEffect, useState } from 'react'

import type { GameState, PlayerId } from '../../engine'
import { applyAction, currentPlayer, everyoneVoted } from '../../engine'
import { useT } from '../../i18n'
import { PassGate } from '../components/PassGate'
import { PhaseHeader } from '../components/PhaseHeader'
import { PlayerPicker } from '../components/PlayerPicker'

export function Vote(props: {
  game: GameState
  setGame: (state: GameState) => void
  onQuit: () => void
}) {
  return props.game.rules.voteStyle === 'open' ? <OpenVote {...props} /> : <SecretVote {...props} />
}

/** Pass-and-tap. Each vote is entered privately, so nobody can follow anybody. */
function SecretVote({
  game,
  setGame,
  onQuit,
}: {
  game: GameState
  setGame: (state: GameState) => void
  onQuit: () => void
}) {
  const { t } = useT()
  const [ready, setReady] = useState(false)
  const player = currentPlayer(game)

  useEffect(() => setReady(false), [game.cursor])

  if (!player) return null

  return (
    <>
      <PhaseHeader
        titleKey="vote.title"
        progressKey="night.progress"
        seat={game.cursor}
        players={game.players.length}
        onQuit={onQuit}
      />

      {!ready ? (
        <PassGate name={player.name} onReady={() => setReady(true)} />
      ) : (
        <div className="card">
          <h3>{t('vote.question')}</h3>
          <p className="muted small">{t('vote.secretHint')}</p>
          <PlayerPicker
            players={game.players.filter((p) => p.id !== player.id)}
            selected={[]}
            onSelect={(ids) => {
              // Cast and hand on in one tap, so the choice is never left on screen.
              const voted = applyAction(game, {
                type: 'castVote',
                playerId: player.id,
                targetId: ids[0],
              })
              setGame(applyAction(voted, { type: 'advance' }))
            }}
          />
        </div>
      )}
    </>
  )
}

/**
 * The version for a table that would rather point at each other: a countdown,
 * everyone points for real, then the answers get tapped in together.
 */
function OpenVote({
  game,
  setGame,
  onQuit,
}: {
  game: GameState
  setGame: (state: GameState) => void
  onQuit: () => void
}) {
  const { t } = useT()
  const [count, setCount] = useState<number | null>(null)
  const [pointed, setPointed] = useState(false)

  useEffect(() => {
    if (count === null) return
    if (count <= 0) {
      setPointed(true)
      return
    }
    const timer = window.setTimeout(() => setCount(count - 1), 900)
    return () => window.clearTimeout(timer)
  }, [count])

  if (!pointed) {
    return (
      <>
        <PhaseHeader titleKey="vote.title" onQuit={onQuit} />
        <div className="card center stack">
          <h2>{t('vote.openTitle')}</h2>
          <p className="muted small">{t('vote.openHint')}</p>
          {count === null ? (
            <button className="btn primary block" onClick={() => setCount(3)}>
              {t('vote.openStart')}
            </button>
          ) : (
            <div className="countdown" aria-live="assertive">
              {count > 0 ? t('vote.openCountdown', { n: count }) : t('vote.openGo')}
            </div>
          )}
        </div>
      </>
    )
  }

  const ready = everyoneVoted(game)

  return (
    <>
      <PhaseHeader titleKey="vote.title" onQuit={onQuit} />
      <div className="card">
        <h3>{t('vote.openTallyTitle')}</h3>
      </div>

      {game.players.map((player) => (
        <div className="card" key={player.id}>
          <h3>{t('vote.openTallyFor', { name: player.name })}</h3>
          <div className="seg">
            {game.players
              .filter((p) => p.id !== player.id)
              .map((target) => (
                <button
                  key={target.id}
                  className={`btn small${player.vote === target.id ? ' selected' : ''}`}
                  aria-pressed={player.vote === target.id}
                  onClick={() =>
                    setGame(
                      applyAction(game, {
                        type: 'castVote',
                        playerId: player.id,
                        targetId: target.id as PlayerId,
                      }),
                    )
                  }
                >
                  {target.name}
                </button>
              ))}
          </div>
        </div>
      ))}

      {!ready && <p className="muted small center">{t('vote.notEveryone')}</p>}

      <button
        className="btn primary block"
        disabled={!ready}
        onClick={() => setGame(applyAction(game, { type: 'advance' }))}
      >
        {t('vote.reveal')}
      </button>
    </>
  )
}
