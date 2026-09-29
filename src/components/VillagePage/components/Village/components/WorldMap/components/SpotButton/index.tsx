// 拡大地図の上に重ねる地点のボタン(✓/? の字 + 番号の札)
import type { CSSProperties, Ref } from 'react'

import type { World } from '@content/types/world'
import type { MapEntry } from '@/lib/village/map-entries'

import { fillPlace } from '../../../../utils/spot-text'
import styles from '../../world-map.module.css'
import { SpotGlyph } from '../SpotGlyph'

type SpotPosition = CSSProperties & {
  '--spot-x': string
  '--spot-y': string
}

export type SpotButtonProps = {
  entry: MapEntry
  world: World
  placeNames: Record<string, string>
  fastTravelLabel: string
  onTravel: (spotId: string) => void
  // 開いた時に焦点を置く最初の地点だけが受け取る
  ref?: Ref<HTMLButtonElement>
}

export function SpotButton({
  entry,
  world,
  placeNames,
  fastTravelLabel,
  onTravel,
  ref,
}: SpotButtonProps) {
  // SVG が流動的に伸縮しても揃うよう、px ではなく mapCanvas に対する割合で置く
  const position: SpotPosition = {
    '--spot-x': `${((entry.cell.x + 0.5) / world.width) * 100}%`,
    '--spot-y': `${((entry.cell.y + 0.5) / world.height) * 100}%`,
  }

  return (
    <button
      ref={ref}
      type='button'
      className={styles.spot}
      style={position}
      data-spot-id={entry.id}
      aria-label={fillPlace(fastTravelLabel, placeNames[entry.id])}
      onClick={() => onTravel(entry.id)}
    >
      <SpotGlyph visited={entry.visited} />
      <span className={styles.badge} data-visited={entry.visited ? 'true' : undefined}>
        {entry.number}
      </span>
    </button>
  )
}

export default SpotButton
