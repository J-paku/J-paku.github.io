// 地図の地形タイルと建物(通行不可のマス)の塗り
import { memo } from 'react'

import { structureRect } from '@/lib/village/collision'

import type { World } from '@content/types/world'

import { MINI_COLORS, structureColor } from '../../utils/map-colors'

export type MapTerrainProps = {
  world: World
  scale: number
}

// 地形と建物はワールドと縮尺だけで決まる(町 30×20 ではタイルだけで 600 枚の rect)。
// 主人公が 1 マス進むたびにミニマップが描き直されても、ここは React の比較ごと飛ばす
export const MapTerrain = memo(function MapTerrain({ world, scale }: MapTerrainProps) {
  return (
    <>
      {world.tiles.flatMap((row, y) =>
        row.map((tile, x) => (
          <rect
            key={`tile-${x}-${y}`}
            x={x * scale}
            y={y * scale}
            width={scale}
            height={scale}
            fill={MINI_COLORS[tile]}
          />
        ))
      )}
      {world.structures.map(structure => {
        if (structure.kind === 'house') {
          return (
            <rect
              key={structure.id}
              x={structure.area.x * scale}
              y={structure.area.y * scale}
              width={structure.area.w * scale}
              height={structure.area.h * scale}
              fill={structureColor(structure)}
            />
          )
        }

        // 地図が描くのは通行不可のマス(structureRect)であって絵の範囲ではない。街灯は絵が縦 2 マスで、
        // 塞ぐのは柱の立つ下の 1 マスだけ — cell(灯)とずれるので位置も structureRect から取る。
        // 絵と食い違って見えても不具合ではない
        const footprint = structureRect(structure)
        const widthInCells = footprint.w

        return (
          <rect
            key={structure.id}
            x={footprint.x * scale}
            y={footprint.y * scale}
            width={widthInCells * scale}
            height={footprint.h * scale}
            fill={structureColor(structure)}
          />
        )
      })}
    </>
  )
})

export default MapTerrain
