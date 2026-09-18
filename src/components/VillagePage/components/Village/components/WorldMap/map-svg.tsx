'use client'
// 縮尺だけを変えて共用する村全体の単純図形地図
import { structureRect } from '@/lib/village/collision'

import type { Cell, Structure, Tile, World } from '@content/types/world'

export type MapSvgProps = {
  world: World
  scale: number
  visited: ReadonlySet<string>
  player: Cell
  destination: Cell | null
  spotIds: readonly string[]
}

// 地図に出るのは屋外だけだが、型を全タイルで埋めるため屋内(floor・wall・mat)も持つ
const MINI_COLORS: Record<Tile, string> = {
  grass: '#6bb36a',
  'grass-alt': '#6bb36a',
  path: '#e0c98a',
  water: '#4f8fd1',
  plaza: '#cfd3c4',
  flower: '#7cc06f',
  tree: '#2f6b3a',
  fence: '#8a6a3a',
  floor: '#e8d090',
  wall: '#785030',
  mat: '#f0e8d0',
  doorway: '#785030',
}

const STRUCTURE_COLORS = {
  'house-red': '#c9553f',
  'house-blue': '#4c6fb0',
  robot: '#8a6a3a',
  mailbox: '#7fb7d6',
  desk: '#8a6a3a',
  bed: '#8a6a3a',
  table: '#8a6a3a',
} as const

function structureColor(structure: Structure) {
  if (structure.kind === 'house') return STRUCTURE_COLORS[`house-${structure.roof}`]

  return STRUCTURE_COLORS[structure.kind]
}

export function MapSvg({ world, scale, visited, player, destination, spotIds }: MapSvgProps) {
  const visibleSpotIds = new Set(spotIds)
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

        const footprint = structureRect(structure)
        const widthInCells = footprint.w

        return (
          <rect
            key={structure.id}
            x={structure.cell.x * scale}
            y={structure.cell.y * scale}
            width={widthInCells * scale}
            height={footprint.h * scale}
            fill={structureColor(structure)}
          />
        )
      })}
      {world.spots
        .filter(spot => visibleSpotIds.has(spot.id))
        .map(spot => (
          <rect
            key={spot.id}
            x={spot.cell.x * scale}
            y={spot.cell.y * scale}
            width={scale}
            height={scale}
            fill={visited.has(spot.id) ? '#1a1a18' : '#fff'}
            stroke='#1a1a18'
            strokeWidth={visited.has(spot.id) ? 0 : 1}
          />
        ))}
      {destination ? (
        <rect
          x={destination.x * scale}
          y={destination.y * scale}
          width={scale}
          height={scale}
          fill='#d8452f'
        />
      ) : null}
      <rect x={player.x * scale} y={player.y * scale} width={scale} height={scale} fill='#fff' />
      <rect
        x={player.x * scale + 1}
        y={player.y * scale + 1}
        width={Math.max(scale - 2, 1)}
        height={Math.max(scale - 2, 1)}
        fill='#1a1a18'
      />
    </svg>
  )
}

export default MapSvg
