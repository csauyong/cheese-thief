import { useCallback, useEffect, useState } from 'react'

import type { GameSetup, GameState } from '../engine'
import { createGame, randomSeed } from '../engine'
import { useT } from '../i18n'
import { saveSetup } from '../store/scoreboard'
import { readJson, remove, writeJson } from '../store/storage'
import { Discussion } from './screens/Discussion'
import { Home } from './screens/Home'
import { Night } from './screens/Night'
import { Results } from './screens/Results'
import { Reveal } from './screens/Reveal'
import { Rules } from './screens/Rules'
import { Scoreboard } from './screens/Scoreboard'
import { Setup } from './screens/Setup'
import { Vote } from './screens/Vote'
import { useWakeLock } from './useWakeLock'

const GAME_KEY = 'cheese-thief:game'

export type View = 'home' | 'setup' | 'game' | 'rules' | 'scoreboard'

export function App() {
  const { t, lang, setLang } = useT()
  const [view, setView] = useState<View>('home')
  // Surviving a refresh matters here: a phone being passed round a table gets
  // backgrounded, rotated and fat-fingered, and losing the deal means redealing.
  const [game, setGame] = useState<GameState | null>(() => readJson<GameState | null>(GAME_KEY, null))

  useWakeLock(view === 'game')

  useEffect(() => {
    if (game) writeJson(GAME_KEY, game)
    else remove(GAME_KEY)
  }, [game])

  const startGame = useCallback((setup: GameSetup) => {
    saveSetup({ names: setup.names, rules: setup.rules })
    setGame(createGame(setup, randomSeed()))
    setView('game')
  }, [])

  const endGame = useCallback(() => {
    setGame(null)
    setView('home')
  }, [])

  const playAgain = useCallback((previous: GameState) => {
    const setup: GameSetup = {
      names: previous.players.map((p) => p.name),
      rules: previous.rules,
    }
    setGame(createGame(setup, randomSeed()))
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <h2>{t('app.name')}</h2>
        <button
          className="btn small ghost"
          onClick={() => setLang(lang === 'zh-TW' ? 'en' : 'zh-TW')}
          aria-label={t('lang.label')}
        >
          {t('lang.switch')}
        </button>
      </header>

      {view === 'home' && (
        <Home
          hasGame={game !== null}
          onNew={() => setView('setup')}
          onResume={() => setView('game')}
          onRules={() => setView('rules')}
          onScoreboard={() => setView('scoreboard')}
        />
      )}

      {view === 'setup' && <Setup onBack={() => setView('home')} onStart={startGame} />}
      {view === 'rules' && <Rules onBack={() => setView('home')} />}
      {view === 'scoreboard' && <Scoreboard onBack={() => setView('home')} />}

      {view === 'game' && game && (
        <GameView game={game} setGame={setGame} onQuit={endGame} onAgain={() => playAgain(game)} />
      )}

      {view === 'game' && !game && <Home
        hasGame={false}
        onNew={() => setView('setup')}
        onResume={() => setView('game')}
        onRules={() => setView('rules')}
        onScoreboard={() => setView('scoreboard')}
      />}
    </div>
  )
}

function GameView({
  game,
  setGame,
  onQuit,
  onAgain,
}: {
  game: GameState
  setGame: (state: GameState) => void
  onQuit: () => void
  onAgain: () => void
}) {
  switch (game.phase) {
    case 'reveal':
      return <Reveal game={game} setGame={setGame} onQuit={onQuit} />
    case 'night':
      return <Night game={game} setGame={setGame} onQuit={onQuit} />
    case 'discussion':
      return <Discussion game={game} setGame={setGame} onQuit={onQuit} />
    case 'vote':
      return <Vote game={game} setGame={setGame} onQuit={onQuit} />
    case 'results':
      return <Results game={game} onAgain={onAgain} onHome={onQuit} />
  }
}
