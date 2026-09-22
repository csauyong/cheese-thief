import { useState } from 'react'

import type { Faction } from '../../engine'
import { useT } from '../../i18n'
import { clearHistory, loadHistory, summarise } from '../../store/scoreboard'

export function Scoreboard({ onBack }: { onBack: () => void }) {
  const { t, list } = useT()
  const [history, setHistory] = useState(loadHistory)
  const summary = summarise(history)

  const factionWinner = (factions: Faction[]) =>
    list(factions.map((f) => t(`scoreboard.faction.${f}` as `scoreboard.faction.${Faction}`)))

  return (
    <>
      <div className="row">
        <button className="btn small ghost" onClick={onBack}>
          {t('common.back')}
        </button>
        <h2 className="spacer">{t('scoreboard.title')}</h2>
      </div>

      {summary.rounds === 0 ? (
        <div className="card center">
          <p className="muted">{t('scoreboard.empty')}</p>
        </div>
      ) : (
        <>
          <p className="muted small">{t('scoreboard.rounds', { n: summary.rounds })}</p>

          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('scoreboard.player')}</th>
                  <th>{t('scoreboard.wins')}</th>
                  <th>{t('scoreboard.played')}</th>
                  <th>{t('scoreboard.asThief')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.players.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.wins}</td>
                    <td>{p.played}</td>
                    <td>{p.asThief}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>{t('scoreboard.factionTitle')}</h3>
            <dl className="kv">
              {summary.factions.map((f) => (
                <FactionRow key={f.faction} faction={f.faction} wins={f.wins} played={f.played} />
              ))}
            </dl>
          </div>

          <div className="card quiet">
            <ul className="muted small">
              {[...history.rounds].reverse().map((round) => (
                <li key={round.seed}>
                  {t('scoreboard.roundLine', {
                    n: round.round,
                    winner: factionWinner(round.winningFactions),
                    thief: round.thiefName,
                  })}
                </li>
              ))}
            </ul>
          </div>

          <button
            className="btn block danger"
            onClick={() => {
              if (!window.confirm(t('scoreboard.resetConfirm'))) return
              clearHistory()
              setHistory(loadHistory())
            }}
          >
            {t('scoreboard.reset')}
          </button>
        </>
      )}
    </>
  )
}

function FactionRow({
  faction,
  wins,
  played,
}: {
  faction: Faction
  wins: number
  played: number
}) {
  const { t } = useT()
  const pct = played === 0 ? 0 : Math.round((wins / played) * 100)
  return (
    <>
      <dt>{t(`scoreboard.faction.${faction}` as `scoreboard.faction.${Faction}`)}</dt>
      <dd>
        {wins} / {played} · {pct}%
      </dd>
    </>
  )
}
