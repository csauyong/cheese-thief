import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/**
 * A join link as a QR code, drawn as one SVG path.
 *
 * Typing a four-character code works fine, but pointing a camera at the host's
 * screen is one step instead of three, and it carries the code in the URL so
 * nobody mistypes it.
 */
export function QrCode({ text, size = 200 }: { text: string; size?: number }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(text)
    qr.make()
    const modules = qr.getModuleCount()
    let d = ''
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (qr.isDark(row, col)) d += `M${col},${row}h1v1h-1z`
      }
    }
    return { path: d, count: modules }
  }, [text])

  const quiet = 2
  const span = count + quiet * 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={text}
      style={{ borderRadius: 8, display: 'block' }}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#f4efe7" />
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={path} fill="#12100e" />
      </g>
    </svg>
  )
}
