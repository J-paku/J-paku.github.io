// 地図の上の主人公の印
import type { Cell } from '@content/types/world'

import { DOT_MARKER_SCALE_LIMIT } from '../../utils/marker-scale'

export type PlayerMarkerProps = {
  cell: Cell
  scale: number
}

// 主人公の印。白い縁 1px に黒の四角。大きい地図はマスちょうどの大きさ、
// ミニマップは点の印(縮尺 + 1 角)より大きく見えるよう、マスの中央から (縮尺 + 2) 角へ広げる
export function PlayerMarker({ cell, scale }: PlayerMarkerProps) {
  const size = scale < DOT_MARKER_SCALE_LIMIT ? scale + 2 : scale
  const left = Math.round(cell.x * scale + scale / 2 - size / 2)
  const top = Math.round(cell.y * scale + scale / 2 - size / 2)

  return (
    <>
      <rect x={left} y={top} width={size} height={size} fill='#fff' />
      <rect
        x={left + 1}
        y={top + 1}
        width={Math.max(size - 2, 1)}
        height={Math.max(size - 2, 1)}
        fill='#1a1a18'
      />
    </>
  )
}

export default PlayerMarker
