import type { Hour } from '../../engine'

const PIPS: Record<Hour, Array<[number, number]>> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 2],
    [1, 3],
    [3, 1],
    [3, 2],
    [3, 3],
  ],
}

/** A die face, drawn rather than written, so it reads the same in both languages. */
export function Die({ value, size = 44 }: { value: Hour; size?: number }) {
  const unit = size / 4
  return (
    <svg
      className="die"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={String(value)}
    >
      <rect x="1" y="1" width={size - 2} height={size - 2} rx={size / 6} strokeWidth="1.5" />
      {PIPS[value].map(([col, row], i) => (
        <circle key={i} cx={col * unit} cy={row * unit} r={size / 13} />
      ))}
    </svg>
  )
}
