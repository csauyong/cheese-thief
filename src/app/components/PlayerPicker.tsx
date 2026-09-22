import type { PlayerId } from '../../engine'

/** Anything with a name is pickable; the picker has no business with roles. */
export interface Pickable {
  id: PlayerId
  name: string
}

/**
 * Pick one player, or several up to a limit. Used for the peek, the thief's
 * choice of 共犯 and the vote, so it stays deliberately plain — no extra
 * information creeps in beside the names.
 */
export function PlayerPicker({
  players,
  selected,
  onSelect,
  max = 1,
  disabled = false,
}: {
  players: readonly Pickable[]
  selected: PlayerId[]
  onSelect: (ids: PlayerId[]) => void
  max?: number
  disabled?: boolean
}) {
  const toggle = (id: PlayerId) => {
    if (max === 1) {
      onSelect([id])
      return
    }
    if (selected.includes(id)) {
      onSelect(selected.filter((s) => s !== id))
      return
    }
    if (selected.length >= max) {
      // Oldest pick drops out, so tapping around never dead-ends.
      onSelect([...selected.slice(1), id])
      return
    }
    onSelect([...selected, id])
  }

  return (
    <div className="stack-sm">
      {players.map((p) => (
        <button
          key={p.id}
          className={`btn block${selected.includes(p.id) ? ' selected' : ''}`}
          aria-pressed={selected.includes(p.id)}
          disabled={disabled}
          onClick={() => toggle(p.id)}
        >
          {p.name}
        </button>
      ))}
    </div>
  )
}
