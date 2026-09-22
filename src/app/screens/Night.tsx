import { useEffect, useState } from 'react'

import type { GameState, PlayerId } from '../../engine'
import { applyAction, currentPlayer, nightReportFor, playerById } from '../../engine'
import { useT } from '../../i18n'
import { Die } from '../components/Die'
import { HoldToReveal } from '../components/HoldToReveal'
import { PassGate } from '../components/PassGate'
import { PhaseHeader } from '../components/PhaseHeader'
import { PlayerPicker } from '../components/PlayerPicker'

/**
 * 夜晚階段, dealt out one seat at a time.
 *
 * On a shared phone the night cannot actually be simultaneous, so each player
 * reads a finished account of their own night instead. The order of reading is
 * seat order and never hour order: who woke before whom is the single most
 * valuable fact in the game, and handing the phone round by hour would print it
 * on the table.
 */
export function Night({
  game,
  setGame,
  onQuit,
}: {
  game: GameState
  setGame: (state: GameState) => void
  onQuit: () => void
}) {
  const { t, list } = useT()
  const [ready, setReady] = useState(false)
  const [seen, setSeen] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const [target, setTarget] = useState<PlayerId[]>([])

  const player = currentPlayer(game)

  useEffect(() => {
    setReady(false)
    setSeen(false)
    setPeeking(false)
    setTarget([])
  }, [game.cursor])

  if (!player) return null

  const report = nightReportFor(game, player.id)
  const names = (ids: PlayerId[]) => list(ids.map((id) => playerById(game, id).name))
  const last = game.cursor === game.players.length - 1

  if (!ready) {
    return (
      <>
        <NightHeader game={game} onQuit={onQuit} />
        <PassGate name={player.name} onReady={() => setReady(true)} />
      </>
    )
  }

  return (
    <>
      <NightHeader game={game} onQuit={onQuit} />

      <HoldToReveal onFirstReveal={() => setSeen(true)}>
        <div className="dice-row">
          {report.hours.map((hour, i) => (
            <Die key={i} value={hour} size={48} />
          ))}
        </div>

        <div className="stack-sm center">
          <strong>{t('night.wokeAt', { hours: list(report.hours.map(String)) })}</strong>

          <p>
            {report.awakeWith.length === 0
              ? t('night.alone')
              : t('night.awakeWith', { names: names(report.awakeWith) })}
          </p>

          <p>{t(`night.cheese.${report.cheese}`)}</p>

          {report.sawTheft && report.thiefId && (
            <p>
              <strong>{t('night.sawThief', { name: playerById(game, report.thiefId).name })}</strong>
            </p>
          )}

          {report.isAccomplice && report.thiefId && (
            <p className="small">
              {t('night.becameAccomplice', { name: playerById(game, report.thiefId).name })}
            </p>
          )}

          {report.sawTheft && !report.isAccomplice && (
            <p className="small muted">{t('night.sawButFree')}</p>
          )}

          {player.id === game.thiefId && (
            <p className="small muted">
              {report.accompliceIds.length > 0
                ? t('night.yourAccomplices', { names: names(report.accompliceIds) })
                : t('night.noAccomplices')}
            </p>
          )}

          {report.peekedAt && (
            <p>
              {t('night.peekResult', {
                name: playerById(game, report.peekedAt.playerId).name,
                hour: report.peekedAt.dice.join('、'),
              })}
            </p>
          )}

          {!report.canPeek && !report.peekedAt && report.awakeWith.length > 0 && (
            <p className="small muted">{t('night.noPeek')}</p>
          )}
        </div>
      </HoldToReveal>

      {seen && report.canPeek && !peeking && (
        <div className="card">
          <p>{t('night.peekOffer')}</p>
          <button className="btn primary block" onClick={() => setPeeking(true)}>
            {t('night.peekPick')}
          </button>
        </div>
      )}

      {seen && report.canPeek && peeking && (
        <div className="card">
          <h3>{t('night.peekPick')}</h3>
          <PlayerPicker
            players={game.players.filter((p) => p.id !== player.id)}
            selected={target}
            onSelect={(ids) => {
              setTarget(ids)
              setGame(
                applyAction(game, { type: 'peek', playerId: player.id, targetId: ids[0] }),
              )
            }}
          />
          <button className="btn small ghost block" onClick={() => setPeeking(false)}>
            {t('night.peekSkip')}
          </button>
        </div>
      )}

      {seen && report.peekedAt && <p className="small muted center">{t('night.peekDone')}</p>}

      {seen && (
        <button
          className="btn primary block"
          onClick={() => setGame(applyAction(game, { type: 'advance' }))}
        >
          {last ? t('pass.doneLast') : t('pass.done')}
        </button>
      )}
    </>
  )
}

function NightHeader({ game, onQuit }: { game: GameState; onQuit: () => void }) {
  return (
    <PhaseHeader
      titleKey="night.title"
      progressKey="night.progress"
      seat={game.cursor}
      players={game.players.length}
      onQuit={onQuit}
    />
  )
}
