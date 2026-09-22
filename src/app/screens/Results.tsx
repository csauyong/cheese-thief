import { useEffect } from 'react'

import type { Faction, GameState, Player } from '../../engine'
import { decideOutcome, playerById, wakeHoursOf } from '../../engine'
import { useT } from '../../i18n'
import { recordRound } from '../../store/scoreboard'
import { Die } from '../components/Die'

export function Results({
  game,
  onAgain,
  onHome,
}: {
  game: GameState
  onAgain: () => void
  onHome: () => void
}) {
  const { t, list } = useT()
  const outcome = decideOutcome(game)

  useEffect(() => {
    recordRound(game, (id) => wakeHoursOf(playerById(game, id), game.preset))
  }, [game])

  const names = (ids: string[]) => list(ids.map((id) => playerById(game, id).name))
  const accomplices = game.players.filter((p) => p.isAccomplice)
  const scapegoat = game.players.find((p) => p.role === 'scapegoat')
  const tiedForTop = outcome.tally.topIds.length > 1

  return (
    <>
      <div className="row">
        <h2 className="spacer">{t('results.title')}</h2>
      </div>

      {outcome.winningFactions.map((faction) => (
        <div className={`banner ${faction}`} key={faction}>
          {faction === 'thief' && accomplices.length === 0
            ? t('results.win.thiefAlone')
            : t(`results.win.${faction}` as `results.win.${Faction}`)}
        </div>
      ))}

      <div className="card">
        <h3>{t('results.thiefWas', { name: playerById(game, game.thiefId).name })}</h3>
        <p className="muted small">
          {outcome.thiefCaught ? t('results.caught') : t('results.escaped')}
        </p>
        <p className="small">
          {accomplices.length > 0
            ? t('results.accomplices', { names: names(accomplices.map((p) => p.id)) })
            : t('results.noAccomplices')}
        </p>
        {scapegoat && (
          <p className="small">{t('results.scapegoat', { name: scapegoat.name })}</p>
        )}
        <hr className="divider" />
        <p className="small">
          {outcome.tally.topIds.length === 0
            ? t('results.noVotes')
            : t('results.topVote', {
                names: names(outcome.tally.topIds),
                n: outcome.tally.highest,
              })}
        </p>
        {tiedForTop && <p className="muted small">{t('results.tieNote')}</p>}
      </div>

      <div className="card">
        <h3>{t('results.nightTitle')}</h3>
        <div className="stack-sm">
          {game.players.map((player) => (
            <PlayerLine key={player.id} game={game} player={player} />
          ))}
        </div>
      </div>

      <div className="card quiet">
        <h3>{t('results.votesTitle')}</h3>
        <ul className="muted small">
          {game.players.map((player) => (
            <li key={player.id}>
              {t('results.voteLine', {
                from: player.name,
                to: player.vote ? playerById(game, player.vote).name : t('common.none'),
              })}
            </li>
          ))}
        </ul>
      </div>

      <button className="btn primary block" onClick={onAgain}>
        {t('results.again')}
      </button>
      <button className="btn block ghost" onClick={onHome}>
        {t('results.home')}
      </button>
    </>
  )
}

function PlayerLine({ game, player }: { game: GameState; player: Player }) {
  const { t, list } = useT()
  const hours = wakeHoursOf(player, game.preset)
  const isThief = player.id === game.thiefId
  return (
    <div className="row">
      <span style={{ minWidth: '4.5em' }}>{player.name}</span>
      {hours.map((hour, i) => (
        <Die key={i} value={hour} size={26} />
      ))}
      <span className="muted small">
        {t('results.dieLine', { hours: list(hours.map(String)) })}
      </span>
      <span className="spacer" />
      {isThief && <span className="tag thief">{t('role.thief')}</span>}
      {player.isAccomplice && <span className="tag accomplice">{t('role.accomplice')}</span>}
      {player.role === 'scapegoat' && <span className="tag scapegoat">{t('role.scapegoat')}</span>}
    </div>
  )
}
