// 全地点を選んで素早く移動できる焦点管理付き拡大地図
'use client'

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react'

import type { Cell, World } from '@content/types/world'

import { MapSvg } from './map-svg'
import styles from './world-map.module.css'

export type WorldMapProps = {
  world: World
  visited: ReadonlySet<string>
  player: Cell
  destination: Cell | null
  placeNames: Record<string, string>
  title: string
  fastTravelLabel: string
  closeLabel: string
  onTravel: (spotId: string) => void
  onClose: () => void
  returnTo: RefObject<HTMLElement | null>
}

type SpotPosition = CSSProperties & {
  '--spot-x': string
  '--spot-y': string
}

// mapCanvas の width/aspect-ratio を CSS の calc() から計算するためのマスの縦横比
type MapCanvasStyle = CSSProperties & {
  '--map-w': string
  '--map-h': string
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href]'
const SCALE = 16
// ラベルが右へ突き出す地点(枠の右端に近い)はラベルを右揃えへ切り替える境界(幅に対する割合)
const RIGHT_EDGE_RATIO = 0.66

export function WorldMap({
  world,
  visited,
  player,
  destination,
  placeNames,
  title,
  fastTravelLabel,
  closeLabel,
  onTravel,
  onClose,
  returnTo,
}: WorldMapProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const firstSpotRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const returnTarget = returnTo.current
    firstSpotRef.current?.focus()

    return () => {
      returnTarget?.focus()
    }
  }, [returnTo])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    // M は開閉の切り替え。地図の中でも閉じられる
    if (event.code === 'KeyM') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusable?.length) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
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
          <div className={styles.mapCanvas} style={mapCanvasStyle}>
            <MapSvg
              world={world}
              scale={SCALE}
              visited={visited}
              player={player}
              destination={destination}
              spotIds={Object.keys(placeNames)}
            />
            {world.spots.map((spot, index) => {
              const placeName = placeNames[spot.id]
              // SVG が流動的に伸縮しても揃うよう、px ではなく mapCanvas に対する割合で置く
              const position: SpotPosition = {
                '--spot-x': `${((spot.cell.x + 0.5) / world.width) * 100}%`,
                '--spot-y': `${((spot.cell.y + 0.5) / world.height) * 100}%`,
              }
              // 右端に近い地点はラベルが枠外へ突き出すので、右揃えに切り替える印を付ける
              const edge =
                (spot.cell.x + 0.5) / world.width > RIGHT_EDGE_RATIO ? 'right' : undefined

              return (
                <button
                  key={spot.id}
                  ref={index === 0 ? firstSpotRef : undefined}
                  type='button'
                  className={styles.spot}
                  style={position}
                  data-edge={edge}
                  aria-label={fastTravelLabel.replace('{place}', placeName)}
                  onClick={() => onTravel(spot.id)}
                >
                  {/* 下向きの地点(建物が下にある)はラベルを上に出し、隣の地点のラベルと重ねない */}
                  <span
                    className={spot.facing === 'down' ? styles.spotLabelAbove : styles.spotLabel}
                  >
                    {placeName}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorldMap
