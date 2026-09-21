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
  monument: '#9a9a8c',
  stele: '#9a9a8c',
  lamp: '#c9a13c',
  campfire: '#c9843e',
  clock: '#8a6a3a',
} as const

function structureColor(structure: Structure) {
  if (structure.kind === 'house') return STRUCTURE_COLORS[`house-${structure.roof}`]

  return STRUCTURE_COLORS[structure.kind]
}

// 会話地点の印。訪問済みの緑は地図の草(#6bb36a)と紛れないよう濃くする
const MARKER_COLORS = {
  visited: '#2f9e44',
  unvisited: '#1a1a18',
  plate: '#fff',
  plateEdge: '#1a1a18',
} as const

// 7×7 のドット絵。フォント依存で滲むため <text> は使わず '#' の位置に rect を置く
const CHECK_GLYPH: readonly string[] = [
  '.......',
  '.....##',
  '....##.',
  '##.##..',
  '.###...',
  '..##...',
  '.......',
]

// 「?」は下敷きの縁と同じ黒なので、左右 1 ドットを空けて縁と繋がらないようにする
const QUESTION_GLYPH: readonly string[] = [
  '..###..',
  '.##.##.',
  '....##.',
  '...##..',
  '...##..',
  '.......',
  '...##..',
]

const GLYPH_CELLS = 7
// 字の周りを 1 ドットずつ広げた白い下敷き(縁の黒 1 ドットを含めて 9 ドット角)
const PLATE_CELLS = GLYPH_CELLS + 2

type SpotMarkerProps = {
  cell: Cell
  scale: number
  visited: boolean
}

function SpotMarker({ cell, scale, visited }: SpotMarkerProps) {
  // 1 ドットの辺。縮尺 4 なら 1px(字 7px・下敷き 9px)、縮尺 16 なら 3px(字 21px・下敷き 27px)
  const dot = Math.max(1, Math.round(scale / 5))
  const glyphSize = GLYPH_CELLS * dot
  const plateSize = PLATE_CELLS * dot
  // 地点マスの中心に置く。ドットの格子がずれないよう整数へ丸める
  const left = Math.round(cell.x * scale + scale / 2 - glyphSize / 2)
  const top = Math.round(cell.y * scale + scale / 2 - glyphSize / 2)
  const glyph = visited ? CHECK_GLYPH : QUESTION_GLYPH
  const inkColor = visited ? MARKER_COLORS.visited : MARKER_COLORS.unvisited

  return (
    <g>
      <rect
        x={left - dot}
        y={top - dot}
        width={plateSize}
        height={plateSize}
        fill={MARKER_COLORS.plateEdge}
      />
      <rect x={left} y={top} width={glyphSize} height={glyphSize} fill={MARKER_COLORS.plate} />
      {glyph.flatMap((row, rowIndex) =>
        row
          .split('')
          .flatMap((pixel, colIndex) =>
            pixel === '#'
              ? [
                  <rect
                    key={`${colIndex}-${rowIndex}`}
                    x={left + colIndex * dot}
                    y={top + rowIndex * dot}
                    width={dot}
                    height={dot}
                    fill={inkColor}
                  />,
                ]
              : []
          )
      )}
    </g>
  )
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
          <SpotMarker key={spot.id} cell={spot.cell} scale={scale} visited={visited.has(spot.id)} />
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
