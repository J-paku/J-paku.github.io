'use client'
// 縮尺だけを変えて共用する村全体の単純図形地図
import { memo } from 'react'

import { structureRect } from '@/lib/village/collision'
import { isDoorVisited, type DoorMarker } from '@/lib/village/door-marker'

import type { Cell, Structure, Tile, World } from '@content/types/world'

export type MapSvgProps = {
  world: World
  scale: number
  visited: ReadonlySet<string>
  player: Cell
  destination: Cell | null
  spotIds: readonly string[]
  // 屋内の地点(自室の home など)の代わりに印を置く扉
  doors: readonly DoorMarker[]
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

// この縮尺より小さい地図(ミニマップの 4)では字が 1 マスに収まらず、隣の印と重なって潰れる。
// 字の代わりに点で描く境目
const DOT_MARKER_SCALE_LIMIT = 8

type SpotMarkerProps = {
  cell: Cell
  scale: number
  visited: boolean
}

// ミニマップの印。マスの中央に (縮尺 - 1) 角の色の点を、1px の白い縁で囲んで置く。
// 奇数角を偶数のマスに置くので半ピクセルは左上へ寄せ、格子からずらさない
function DotMarker({ cell, scale, visited }: SpotMarkerProps) {
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
}

// 印の中身は地点のマス・縮尺・訪問済みかだけで決まる。歩くたびの再描画では作り直さない
const SpotMarker = memo(function SpotMarker({ cell, scale, visited }: SpotMarkerProps) {
  if (scale < DOT_MARKER_SCALE_LIMIT) {
    return <DotMarker cell={cell} scale={scale} visited={visited} />
  }

  // 1 ドットの辺。縮尺 16 なら 3px(字 21px・下敷き 27px)
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
})

type MapTerrainProps = {
  world: World
  scale: number
}

// 地形と建物はワールドと縮尺だけで決まる(町 30×20 ではタイルだけで 600 枚の rect)。
// 主人公が 1 マス進むたびにミニマップが描き直されても、ここは React の比較ごと飛ばす
const MapTerrain = memo(function MapTerrain({ world, scale }: MapTerrainProps) {
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
      {world.spots
        .filter(spot => visibleSpotIds.has(spot.id))
        .map(spot => (
          <SpotMarker key={spot.id} cell={spot.cell} scale={scale} visited={visited.has(spot.id)} />
        ))}
      {doors.map(door => (
        <SpotMarker
          key={`door-${door.id}`}
          cell={door.cell}
          scale={scale}
          visited={isDoorVisited(door, visited)}
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
      {/* 主人公は印より後(= 上)に描き、印に埋もれないようにする */}
      <PlayerMarker cell={player} scale={scale} />
    </svg>
  )
}

type PlayerMarkerProps = {
  cell: Cell
  scale: number
}

// 主人公の印。白い縁 1px に黒の四角。大きい地図はマスちょうどの大きさ、
// ミニマップは点の印(縮尺 + 1 角)より大きく見えるよう、マスの中央から (縮尺 + 2) 角へ広げる
function PlayerMarker({ cell, scale }: PlayerMarkerProps) {
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

export default MapSvg
