import { useEffect, useState } from 'react'

import type { Faction, PlayerId } from '../../engine'
import { HOURS } from '../../engine'
import { useT } from '../../i18n'
import type { ClientMessage, ClientView } from '../../net'
import { Die } from '../components/Die'
import { HoldToReveal } from '../components/HoldToReveal'
import { PlayerPicker } from '../components/PlayerPicker'

/**
 * One phone's whole game, rendered from the view the host sent it.
 *
 * There is nothing to hide here by hand: a phone is never told anybody else's
 * card, so there is no branch that could accidentally show one. The host and the
 * other players run exactly this screen, the host merely getting the narrator's
 * buttons as well.
 */
export function LiveRound({
  view,
  send,
  onLeave,
}: {
  view: ClientView
  send: (message: ClientMessage) => void
  onLeave: () => void
}) {
  const { t } = useT()

  return (
    <>
      <div className="row">
        <h2 className="spacer">{t(`${stageTitleKey(view)}` as 'night.title')}</h2>
        <Roster view={view} />
      </div>

      {view.stage === 'reveal' && <LiveReveal view={view} send={send} />}
      {view.stage === 'night' && <LiveNight view={view} send={send} />}
      {view.stage === 'discussion' && <LiveDiscussion view={view} send={send} />}
      {view.stage === 'vote' && <LiveVote view={view} send={send} />}
      {view.stage === 'results' && <LiveResults view={view} send={send} onLeave={onLeave} />}
    </>
  )
}

function stageTitleKey(view: ClientView): string {
  switch (view.stage) {
    case 'reveal':
      return 'reveal.title'
    case 'night':
      return 'night.title'
    case 'discussion':
      return 'discussion.title'
    case 'vote':
      return 'vote.title'
    case 'results':
      return 'results.title'
    default:
      return 'live.title'
  }
}

function Roster({ view }: { view: ClientView }) {
  const { t } = useT()
  const waiting = view.players.filter((p) => view.waitingOn.includes(p.id))
  if (waiting.length === 0) return null
  return (
    <span className="progress">
      {t('live.waitingOn', { names: waiting.map((p) => p.name).join('、') })}
    </span>
  )
}

function LiveReveal({ view, send }: { view: ClientView; send: (m: ClientMessage) => void }) {
  const { t, list } = useT()
  const [seen, setSeen] = useState(false)
  const you = view.you
  const secret = view.secret
  if (!you || !secret) return null

  const ready = view.players.find((p) => p.id === you.id)?.ready ?? false
  const hours =
    secret.chosenDie !== null ? [secret.dice[secret.chosenDie]] : secret.dice

  return (
    <>
      <HoldToReveal onFirstReveal={() => setSeen(true)}>
        <div className={`role ${secret.role}`}>
          <span className="muted small">{t('reveal.youAre')}</span>
          <span className="role-name">{t(`role.${secret.role}`)}</span>
          <span className="small muted">{t(`role.${secret.role}.blurb`)}</span>
        </div>
        <div className="dice-row">
          {secret.dice.map((die, i) => (
            <Die key={i} value={die} size={52} />
          ))}
        </div>
        {view.pending !== 'die' && (
          <strong>
            {hours.length === 1
              ? t('reveal.yourHour', { hour: hours[0] })
              : t('reveal.thiefHours', { hours: list(hours.map(String)) })}
          </strong>
        )}
      </HoldToReveal>

      {seen && view.pending === 'die' && (
        <div className="card">
          <h3>{t('reveal.chooseDie')}</h3>
          <p className="muted small">{t('reveal.chooseDieHint')}</p>
          <div className="seg">
            {secret.dice.map((die, i) => (
              <button
                key={i}
                className="btn"
                onClick={() =>
                  send({
                    t: 'action',
                    action: { type: 'chooseDie', playerId: you.id, dieIndex: i },
                  })
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

      {seen && view.pending === null && !ready && (
        <button
          className="btn primary block"
          onClick={() => send({ t: 'action', action: { type: 'ready', playerId: you.id } })}
        >
          {t('live.reveal.gotIt')}
        </button>
      )}

      {ready && <p className="muted center">{t('live.reveal.waiting')}</p>}
    </>
  )
}

function LiveNight({ view, send }: { view: ClientView; send: (m: ClientMessage) => void }) {
  const { t, list } = useT()
  const [picked, setPicked] = useState<PlayerId[]>([])
  const you = view.you
  if (!you) return null

  const ready = view.players.find((p) => p.id === you.id)?.ready ?? false
  const report = view.night
  const names = (ids: PlayerId[]) =>
    list(ids.map((id) => view.players.find((p) => p.id === id)?.name ?? id))

  return (
    <>
      <div className="card accent center stack">
        <p className="muted small">{t('live.night.closeEyes')}</p>
        <div className="hour-dial">
          {HOURS.map((hour) => (
            <span key={hour} className={hour === view.nightHour ? 'on' : ''}>
              {hour}
            </span>
          ))}
        </div>
        <h1>{view.nightHour ? t('live.night.hour', { hour: view.nightHour }) : ''}</h1>
        <HourCountdown endsAt={view.hourEndsAt} />
        <strong className={view.awakeNow ? 'awake' : 'muted'}>
          {view.awakeNow ? t('live.night.awake') : t('live.night.asleep')}
        </strong>
      </div>

      {view.awakeNow && report && (
        <HoldToReveal>
          <div className="stack-sm center">
            <p>{t('night.wokeAt', { hours: list(report.hours.map(String)) })}</p>
            <p>
              {report.awakeWith.length === 0
                ? t('night.alone')
                : t('night.awakeWith', { names: names(report.awakeWith) })}
            </p>
            <p>{t(`night.cheese.${report.cheese}`)}</p>
            {report.sawTheft && report.thiefId && (
              <p>
                <strong>{t('night.sawThief', { name: names([report.thiefId]) })}</strong>
              </p>
            )}
            {report.isAccomplice && report.thiefId && (
              <p className="small">
                {t('night.becameAccomplice', { name: names([report.thiefId]) })}
              </p>
            )}
            {report.sawTheft && !report.isAccomplice && (
              <p className="small muted">{t('night.sawButFree')}</p>
            )}
            {report.peekedAt && (
              <p>
                {t('night.peekResult', {
                  name: names([report.peekedAt.playerId]),
                  hour: report.peekedAt.dice.join('、'),
                })}
              </p>
            )}
            {!report.canPeek && !report.peekedAt && report.awakeWith.length > 0 && (
              <p className="small muted">{t('night.noPeek')}</p>
            )}
          </div>
        </HoldToReveal>
      )}

      {view.awakeNow && view.pending === 'accomplices' && (
        <div className="card">
          <h3>{t('reveal.accomplicePick', { n: view.accompliceSlots })}</h3>
          <PlayerPicker
            players={view.witnesses}
            selected={picked}
            onSelect={setPicked}
            max={view.accompliceSlots}
          />
          <button
            className="btn primary block"
            disabled={picked.length !== view.accompliceSlots}
            onClick={() => send({ t: 'action', action: { type: 'designateAccomplices', ids: picked } })}
          >
            {t('common.confirm')}
          </button>
        </div>
      )}

      {view.awakeNow && report?.canPeek && view.pending === null && (
        <div className="card">
          <h3>{t('night.peekPick')}</h3>
          <PlayerPicker
            players={view.players.filter((p) => p.id !== you.id)}
            selected={[]}
            onSelect={(ids) =>
              send({ t: 'action', action: { type: 'peek', playerId: you.id, targetId: ids[0] } })
            }
          />
        </div>
      )}

      {view.awakeNow && view.pending === null && !ready && (
        <button
          className="btn block"
          onClick={() => send({ t: 'action', action: { type: 'ready', playerId: you.id } })}
        >
          {t('live.night.done')}
        </button>
      )}

      {(ready || !view.awakeNow) && (
        <p className="muted small center">{t('live.night.waitingOthers')}</p>
      )}
    </>
  )
}

/**
 * The same countdown on every phone. Every hour lasts the same length whether
 * anyone is awake for it — an hour that ended early would say so.
 */
function HourCountdown({ endsAt }: { endsAt: number | null }) {
  const { t } = useT()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  if (endsAt === null) return null
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000))
  return <span className="muted small">{t('live.night.seconds', { n: seconds })}</span>
}

function LiveDiscussion({ view, send }: { view: ClientView; send: (m: ClientMessage) => void }) {
  const { t, tl } = useT()
  return (
    <>
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
      {view.isHost ? (
        <button className="btn primary block" onClick={() => send({ t: 'advance' })}>
          {t('live.hostToVote')}
        </button>
      ) : (
        <p className="muted small center">{t('live.night.waitingOthers')}</p>
      )}
    </>
  )
}

function LiveVote({ view, send }: { view: ClientView; send: (m: ClientMessage) => void }) {
  const { t } = useT()
  const you = view.you
  if (!you) return null

  if (view.vote) return <p className="muted center">{t('live.yourVoteIn')}</p>

  return (
    <div className="card">
      <h3>{t('vote.question')}</h3>
      <p className="muted small">{t('vote.secretHint')}</p>
      <PlayerPicker
        players={view.players.filter((p) => p.id !== you.id)}
        selected={[]}
        onSelect={(ids) =>
          send({ t: 'action', action: { type: 'castVote', playerId: you.id, targetId: ids[0] } })
        }
      />
    </div>
  )
}

function LiveResults({
  view,
  send,
  onLeave,
}: {
  view: ClientView
  send: (m: ClientMessage) => void
  onLeave: () => void
}) {
  const { t, list } = useT()
  const outcome = view.outcome
  if (!outcome) return null

  const name = (id: PlayerId) => view.players.find((p) => p.id === id)?.name ?? id
  const names = (ids: PlayerId[]) => list(ids.map(name))

  return (
    <>
      {outcome.winningFactions.map((faction: Faction) => (
        <div className={`banner ${faction}`} key={faction}>
          {faction === 'thief' && outcome.accompliceIds.length === 0
            ? t('results.win.thiefAlone')
            : t(`results.win.${faction}` as `results.win.${Faction}`)}
        </div>
      ))}

      <div className="card">
        <h3>{t('results.thiefWas', { name: name(outcome.thiefId) })}</h3>
        <p className="muted small">
          {outcome.thiefCaught ? t('results.caught') : t('results.escaped')}
        </p>
        <p className="small">
          {outcome.accompliceIds.length > 0
            ? t('results.accomplices', { names: names(outcome.accompliceIds) })
            : t('results.noAccomplices')}
        </p>
        {outcome.scapegoatId && (
          <p className="small">{t('results.scapegoat', { name: name(outcome.scapegoatId) })}</p>
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
      </div>

      {view.isHost && (
        <button className="btn primary block" onClick={() => send({ t: 'again' })}>
          {t('live.again')}
        </button>
      )}
      <button className="btn block ghost" onClick={onLeave}>
        {t('live.leave')}
      </button>
    </>
  )
}
