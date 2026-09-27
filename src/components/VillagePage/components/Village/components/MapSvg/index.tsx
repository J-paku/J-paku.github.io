'use client'
// 縮尺だけを変えて共用する村全体の単純図形地図
import { isDoorVisited, type DoorMarker } from '@/lib/village/door-marker'

import type { Cell, World } from '@content/types/world'

import { MapTerrain } from './components/MapTerrain'
import { PlayerMarker } from './components/PlayerMarker'
import { SpotMarker } from './components/SpotMarker'
import { DOT_MARKER_SCALE_LIMIT } from './utils/marker-scale'

export type MapSvgProps = {
  world: World
  scale: number
  visited: ReadonlySet<string>
  player: Cell
  destination: Cell | null
  // 印を置く地点と扉。点の印を描くミニマップだけが使い、拡大地図(縮尺 16)では描かない
  spotIds: readonly string[]
  // 屋内の地点(自室の home など)の代わりに印を置く扉
  doors: readonly DoorMarker[]
}

export function MapSvg({
  world,
  scale,
  visited,
  player,
  destination,
  spotIds,
  doors,
}: MapSvgProps) {
  const visibleSpotIds = new Set(spotIds)
  // 拡大地図では地点のボタンが ✓/? の字を持つので、点の印はミニマップだけで描く
  const drawMarkers = scale < DOT_MARKER_SCALE_LIMIT
  const width = world.width * scale
  const height = world.height * scale

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering='crispEdges'
      aria-hidden='true'
    >
      <MapTerrain world={world} scale={scale} />
      {drawMarkers
        ? world.spots
            .filter(spot => visibleSpotIds.has(spot.id))
            .map(spot => (
              <SpotMarker
                key={spot.id}
                cell={spot.cell}
                scale={scale}
                visited={visited.has(spot.id)}
              />
            ))
        : null}
      {drawMarkers
        ? doors.map(door => (
            <SpotMarker
              key={`door-${door.id}`}
              cell={door.cell}
              scale={scale}
              visited={isDoorVisited(door, visited)}
            />
          ))
        : null}
      {destination ? (
        <rect
          x={destination.x * scale}
          y={destination.y * scale}
          width={scale}
          height={scale}
          fill='#d8452f'
        />
      ) : null}
      {/* 主人公は印より後(= 上)に描き、印に埋もれないようにする */}
      <PlayerMarker cell={player} scale={scale} />
    </svg>
  )
}

export default MapSvg
