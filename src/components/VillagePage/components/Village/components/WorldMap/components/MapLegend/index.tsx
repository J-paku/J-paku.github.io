// 拡大地図の下に並べる、番号と地点の名前の対応表
import type { MapEntry } from '@/lib/village/map-entries'

import styles from '../../world-map.module.css'

export type MapLegendProps = {
  entries: MapEntry[]
  placeNames: Record<string, string>
  onTravel: (spotId: string) => void
}

// 地図の番号と地点の名前の対応表。地図の中に字を置くと名前どうしが重なるので、名前はここにだけ出す。
// 焦点の方向移動の対象は地図の札だけなので、ここのボタンには data-spot-id を付けない
export function MapLegend({ entries, placeNames, onTravel }: MapLegendProps) {
  return (
    <ol className={styles.legend}>
      {entries.map(entry => (
        <li key={entry.id}>
          <button type='button' className={styles.legendItem} onClick={() => onTravel(entry.id)}>
            <span className={styles.badge} data-visited={entry.visited ? 'true' : undefined}>
              {entry.number}
            </span>
            <span className={styles.legendName}>{placeNames[entry.id]}</span>
            {/* 訪問済みは色だけでなく印でも示す */}
            {entry.visited ? <span className={styles.legendCheck}>✓</span> : null}
          </button>
        </li>
      ))}
    </ol>
  )
}

export default MapLegend
