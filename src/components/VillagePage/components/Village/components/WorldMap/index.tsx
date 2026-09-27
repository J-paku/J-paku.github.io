// 全地点を選んで素早く移動できる焦点管理付き拡大地図
'use client'

import { useId, type CSSProperties, type MouseEvent, type RefObject } from 'react'

import type { Cell, Direction, World } from '@content/types/world'
import type { DoorMarker } from '@/lib/village/door-marker'
import type { MapEntry } from '@/lib/village/map-entries'

import { MapSvg } from '../MapSvg'
import { MapLegend } from './components/MapLegend'
import { SpotButton } from './components/SpotButton'
import { useBadgeLayout } from './hooks/use-badge-layout'
import { useMapFocus } from './hooks/use-map-focus'
import { cellFromClick } from './utils/cell-from-click'
import styles from './world-map.module.css'

export type WorldMapProps = {
  world: World
  visited: ReadonlySet<string>
  player: Cell
  destination: Cell | null
  placeNames: Record<string, string>
  doors: readonly DoorMarker[]
  // 地図の ✓/? の字の右上に番号の札を置き、下の一覧に並べる地点(番号はコース順)。他の世界の地点は入口のマスに置かれている
  entries: MapEntry[]
  title: string
  fastTravelLabel: string
  closeLabel: string
  onTravel: (spotId: string) => void
  // 地点ではない任意のマスを押した時の移動
  onTravelTo: (cell: Cell) => void
  onClose: () => void
  returnTo: RefObject<HTMLElement | null>
  // スティックの押しっぱなしの向き。地図を開いている間も村の入力は重ね表示中としてここへ書き、地図は読むだけ
  scrollHeldRef: RefObject<Direction | null>
}

// mapCanvas の width/aspect-ratio を CSS の calc() から計算するためのマスの縦横比
type MapCanvasStyle = CSSProperties & {
  '--map-w': string
  '--map-h': string
}

const SCALE = 16

export function WorldMap({
  world,
  visited,
  player,
  destination,
  placeNames,
  doors,
  entries,
  title,
  fastTravelLabel,
  closeLabel,
  onTravel,
  onTravelTo,
  onClose,
  returnTo,
  scrollHeldRef,
}: WorldMapProps) {
  const titleId = useId()
  const { panelRef, firstSpotRef, handleKeyDown } = useMapFocus({
    entries,
    returnTo,
    scrollHeldRef,
    onClose,
  })
  const canvasRef = useBadgeLayout({ entries, world })

  // 地点のボタン以外の所を押したら、押した位置のマスへ歩く
  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button') !== null) return
    const cell = cellFromClick(event, event.currentTarget.getBoundingClientRect(), world)
    if (cell !== null) onTravelTo(cell)
  }

  const mapCanvasStyle: MapCanvasStyle = {
    '--map-w': `${world.width}`,
    '--map-h': `${world.height}`,
  }

  return (
    <div
      className={styles.overlay}
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      <div ref={panelRef} className={styles.panel}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type='button' className={styles.close} onClick={onClose}>
          {closeLabel}
        </button>
        <div className={styles.mapViewport}>
          <div
            ref={canvasRef}
            className={styles.mapCanvas}
            style={mapCanvasStyle}
            onClick={handleCanvasClick}
          >
            <MapSvg
              world={world}
              scale={SCALE}
              visited={visited}
              player={player}
              destination={destination}
              spotIds={Object.keys(placeNames)}
              doors={doors}
            />
            {entries.map((entry, index) => (
              <SpotButton
                key={entry.id}
                ref={index === 0 ? firstSpotRef : undefined}
                entry={entry}
                world={world}
                placeNames={placeNames}
                fastTravelLabel={fastTravelLabel}
                onTravel={onTravel}
              />
            ))}
          </div>
        </div>
        <MapLegend entries={entries} placeNames={placeNames} onTravel={onTravel} />
      </div>
    </div>
  )
}

export default WorldMap
