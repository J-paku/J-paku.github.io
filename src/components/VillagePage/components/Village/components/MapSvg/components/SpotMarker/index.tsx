// ミニマップの地点・扉の点の印
import { memo } from 'react'

import type { Cell } from '@content/types/world'

import { MARKER_COLORS } from '../../../../utils/marker-colors'

export type SpotMarkerProps = {
  cell: Cell
  scale: number
  visited: boolean
}

// ミニマップの印。マスの中央に (縮尺 - 1) 角の色の点を、1px の白い縁で囲んで置く。
// 奇数角を偶数のマスに置くので半ピクセルは左上へ寄せ、格子からずらさない。
// 印の中身は地点のマス・縮尺・訪問済みかだけで決まる。歩くたびの再描画では作り直さない
export const SpotMarker = memo(function SpotMarker({ cell, scale, visited }: SpotMarkerProps) {
  const inner = Math.max(1, scale - 1)
  const outer = inner + 2
  const left = Math.round(cell.x * scale + scale / 2 - outer / 2)
  const top = Math.round(cell.y * scale + scale / 2 - outer / 2)

  return (
    <g>
      <rect x={left} y={top} width={outer} height={outer} fill={MARKER_COLORS.plate} />
      <rect
        x={left + 1}
        y={top + 1}
        width={inner}
        height={inner}
        fill={visited ? MARKER_COLORS.visited : MARKER_COLORS.unvisited}
      />
    </g>
  )
})

export default SpotMarker
