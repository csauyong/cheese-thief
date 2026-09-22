import { useEffect, useState } from 'react'

import type { GameState, PlayerId } from '../../engine'
import {
  accompliceSlots,
  applyAction,
  currentPlayer,
  pendingChoice,
  wakeHoursOf,
  witnessesOf,
} from '../../engine'
import { useT } from '../../i18n'
import { Die } from '../components/Die'
import { HoldToReveal } from '../components/HoldToReveal'
import { PassGate } from '../components/PassGate'
import { PhaseHeader } from '../components/PhaseHeader'
import { PlayerPicker } from '../components/PlayerPicker'

/**
 * 身分揭曉. Seats are visited in order, and both of the night's interactive
 * choices happen here rather than during the night itself — the thief's pick of
 * 共犯, and the 4人 die choice. Deciding them now is what lets the night phase
 * hand out finished reports in seat order instead of hour order.
 */
export function Reveal({
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
  const [picked, setPicked] = useState<PlayerId[]>([])

  const player = currentPlayer(game)

  useEffect(() => {
    setReady(false)
    setSeen(false)
    setPicked([])
  }, [game.cursor])

  if (!player) return null

  const isThief = player.id === game.thiefId
  const hours = wakeHoursOf(player, game.preset)
  const choice = pendingChoice(game)
  const witnesses = isThief ? witnessesOf(game) : []
  const slots = accompliceSlots(game)
  const autoAccomplices = game.players.filter((p) => p.isAccomplice)
  const last = game.cursor === game.players.length - 1

  if (!ready) {
    return (
      <>
        <PhaseHeader
          titleKey="reveal.title"
          progressKey="reveal.progress"
          seat={game.cursor}
          players={game.players.length}
          onQuit={onQuit}
        />
        <PassGate name={player.name} onReady={() => setReady(true)} />
      </>
    )
  }

  return (
    <>
      <PhaseHeader
          titleKey="reveal.title"
          progressKey="reveal.progress"
          seat={game.cursor}
          players={game.players.length}
          onQuit={onQuit}
        />

      <HoldToReveal onFirstReveal={() => setSeen(true)}>
        <div className={`role ${player.role}`}>
          <span className="muted small">{t('reveal.youAre')}</span>
          <span className="role-name">{t(`role.${player.role}`)}</span>
          <span className="small muted">{t(`role.${player.role}.blurb`)}</span>
        </div>

        <div className="dice-row">
          {player.dice.map((die, i) => (
            <Die key={i} value={die} size={52} />
          ))}
        </div>

        {isThief && game.preset.thiefWakesOnAllDice ? (
          <div className="center stack-sm">
            <strong>{t('reveal.thiefHours', { hours: list(hours.map(String)) })}</strong>
            <span className="small muted">{t('reveal.thiefHoursHint')}</span>
          </div>
        ) : hours.length === 1 ? (
          <strong>{t('reveal.yourHour', { hour: hours[0] })}</strong>
        ) : (
          <span className="muted">{t('reveal.chooseDie')}</span>
        )}

        {isThief && slots > 0 && witnesses.length <= slots && (
          <p className="small muted center">
            {t('reveal.accompliceAuto', {
              names: list(autoAccomplices.map((p) => p.name)),
            })}
          </p>
        )}
        {isThief && game.preset.accompliceCap > 0 && witnesses.length === 0 && (
          <p className="small muted center">{t('reveal.accompliceNone')}</p>
        )}
      </HoldToReveal>

      {seen && choice === 'die' && (
        <div className="card">
          <h3>{t('reveal.chooseDie')}</h3>
          <p className="muted small">{t('reveal.chooseDieHint')}</p>
          <div className="seg">
            {player.dice.map((die, i) => (
              <button
                key={i}
                className="btn"
                onClick={() =>
                  setGame(applyAction(game, { type: 'chooseDie', playerId: player.id, dieIndex: i }))
                }
              >
                <span className="row" style={{ justifyContent: 'center' }}>
                  <Die value={die} size={36} />
                  <span>{die}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {seen && choice === 'accomplices' && (
        <div className="card">
          <h3>{t('reveal.accomplicePick', { n: slots })}</h3>
          <PlayerPicker
            players={witnesses}
            selected={picked}
            onSelect={setPicked}
            max={slots}
          />
          <p className="muted small center">
            {t('reveal.accompliceCount', { n: picked.length, max: slots })}
          </p>
          <button
            className="btn primary block"
            disabled={picked.length !== slots}
            onClick={() => setGame(applyAction(game, { type: 'designateAccomplices', ids: picked }))}
          >
            {t('common.confirm')}
          </button>
        </div>
      )}

      {seen && choice === null && (
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
