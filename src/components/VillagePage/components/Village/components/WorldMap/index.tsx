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

const FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href]'
const SCALE = 16

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
            className={styles.mapCanvas}
            style={{ width: world.width * SCALE, height: world.height * SCALE }}
          >
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
              const position: SpotPosition = {
                '--spot-x': `${spot.cell.x * SCALE + SCALE / 2}px`,
                '--spot-y': `${spot.cell.y * SCALE + SCALE / 2}px`,
              }

              return (
                <button
                  key={spot.id}
                  ref={index === 0 ? firstSpotRef : undefined}
                  type='button'
                  className={styles.spot}
                  style={position}
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
