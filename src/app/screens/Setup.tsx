import { useMemo, useState } from 'react'

import type { GameSetup, RulesConfig, TieRule, VoteStyle } from '../../engine'
import { MAX_PLAYERS, MIN_PLAYERS, presetFor } from '../../engine'
import { useT } from '../../i18n'
import { loadSetup } from '../../store/scoreboard'

const DEFAULT_RULES: RulesConfig = {
  tieRule: 'sleepyheadsWin',
  useScapegoat: true,
  voteStyle: 'secret',
}

export function Setup({
  onBack,
  onStart,
}: {
  onBack: () => void
  onStart: (setup: GameSetup) => void
}) {
  const { t } = useT()
  const remembered = useMemo(loadSetup, [])
  const [names, setNames] = useState<string[]>(
    () => remembered?.names ?? ['', '', '', ''],
  )
  const [rules, setRules] = useState<RulesConfig>(() => ({
    ...DEFAULT_RULES,
    ...remembered?.rules,
  }))
  const [error, setError] = useState<string | null>(null)

  const count = names.length
  const preset = count >= MIN_PLAYERS && count <= MAX_PLAYERS ? presetFor(count) : null

  const setName = (index: number, value: string) =>
    setNames((current) => current.map((n, i) => (i === index ? value : n)))

  const addPlayer = () => setNames((current) => [...current, ''])
  const removePlayer = (index: number) =>
    setNames((current) => current.filter((_, i) => i !== index))

  const start = () => {
    const trimmed = names.map((n) => n.trim())
    if (trimmed.length < MIN_PLAYERS || trimmed.length > MAX_PLAYERS) {
      setError(t('setup.error.count'))
      return
    }
    if (trimmed.some((n) => n.length === 0)) {
      setError(t('setup.error.blank'))
      return
    }
    if (new Set(trimmed).size !== trimmed.length) {
      setError(t('setup.error.duplicate'))
      return
    }
    setError(null)
    onStart({ names: trimmed, rules })
  }

  const cardLine = () => {
    if (!preset) return '—'
    const scapegoat = preset.scapegoatAvailable && rules.useScapegoat
    const mice = count - 1 - (scapegoat ? 1 : 0)
    const parts = [`1 ${t('role.thief')}`, `${mice} ${t('role.sleepyhead')}`]
    if (scapegoat) parts.push(`1 ${t('role.scapegoat')}`)
    return parts.join(' + ')
  }

  return (
    <>
      <div className="row">
        <button className="btn small ghost" onClick={onBack}>
          {t('common.back')}
        </button>
        <h2 className="spacer">{t('setup.title')}</h2>
      </div>

      <div className="card">
        <h3>{t('setup.playersLabel')}</h3>
        <div className="stack-sm">
          {names.map((name, i) => (
            <div className="row" key={i}>
              <input
                type="text"
                value={name}
                placeholder={t('setup.namePlaceholder', { n: i + 1 })}
                onChange={(e) => setName(i, e.target.value)}
                style={{ flex: 1 }}
              />
              {count > MIN_PLAYERS && (
                <button
                  className="btn small ghost"
                  onClick={() => removePlayer(i)}
                  aria-label={t('setup.removePlayer')}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {count < MAX_PLAYERS && (
          <button className="btn small block ghost" onClick={addPlayer}>
            {t('setup.addPlayer')}
          </button>
        )}
      </div>

      {preset && (
        <div className="card">
          <h3>{t('setup.presetTitle', { n: count })}</h3>
          <dl className="kv">
            <dt>{t('setup.preset.dice')}</dt>
            <dd>{t('setup.preset.diceValue', { n: preset.dicePerPlayer })}</dd>

            <dt>{t('setup.preset.cards')}</dt>
            <dd>{cardLine()}</dd>

            <dt>{t('setup.preset.accomplice')}</dt>
            <dd>
              {preset.accompliceCap > 0
                ? preset.accompliceCap
                : t('setup.preset.accompliceNone')}
            </dd>

            <dt>{t('setup.preset.peek')}</dt>
            <dd>{preset.peekAllowed ? t('setup.yes') : t('setup.no')}</dd>

            <dt>{t('setup.preset.thiefWake')}</dt>
            <dd>
              {preset.thiefWakesOnAllDice
                ? t('setup.preset.thiefWakeAll')
                : t('setup.preset.thiefWakeOnce')}
            </dd>
          </dl>

          {preset.scapegoatAvailable && (
            <>
              <hr className="divider" />
              <label className="switch">
                <input
                  type="checkbox"
                  checked={rules.useScapegoat}
                  onChange={(e) => setRules({ ...rules, useScapegoat: e.target.checked })}
                />
                <span>
                  {t('setup.scapegoat')}
                  <br />
                  <span className="muted small">{t('setup.scapegoatHint')}</span>
                </span>
              </label>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3>{t('setup.tieRule')}</h3>
        <div className="seg">
          {(['sleepyheadsWin', 'thiefWins'] as TieRule[]).map((rule) => (
            <button
              key={rule}
              className={`btn small${rules.tieRule === rule ? ' selected' : ''}`}
              aria-pressed={rules.tieRule === rule}
              onClick={() => setRules({ ...rules, tieRule: rule })}
            >
              {rule === 'sleepyheadsWin'
                ? t('setup.tieRule.sleepyheads')
                : t('setup.tieRule.thief')}
            </button>
          ))}
        </div>

        <h3>{t('setup.voteStyle')}</h3>
        <div className="seg">
          {(['secret', 'open'] as VoteStyle[]).map((style) => (
            <button
              key={style}
              className={`btn small${rules.voteStyle === style ? ' selected' : ''}`}
              aria-pressed={rules.voteStyle === style}
              onClick={() => setRules({ ...rules, voteStyle: style })}
            >
              {style === 'secret' ? t('setup.voteStyle.secret') : t('setup.voteStyle.open')}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error center">{error}</p>}

      <button className="btn primary block" onClick={start}>
        {t('setup.start')}
      </button>
    </>
  )
}
