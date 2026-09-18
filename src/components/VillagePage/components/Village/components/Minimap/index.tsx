// 村全体と現在位置を小さく示して拡大地図を開くボタン
'use client'

import type { Cell, World } from '@content/types/world'

import { MapSvg } from '../WorldMap/map-svg'
import styles from './minimap.module.css'

export type MinimapProps = {
  world: World
  visited: ReadonlySet<string>
  player: Cell
  destination: Cell | null
  placeNames: Record<string, string>
  label: string
  onOpen: () => void
}

export function Minimap({
  world,
  visited,
  player,
  destination,
  placeNames,
  label,
  onOpen,
}: MinimapProps) {
  return (
    <button type='button' className={styles.minimap} aria-label={label} onClick={onOpen}>
      <MapSvg
        world={world}
        scale={4}
        visited={visited}
        player={player}
        destination={destination}
        spotIds={Object.keys(placeNames)}
      />
    </button>
  )
}

export default Minimap
