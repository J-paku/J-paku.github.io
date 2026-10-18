// 拡大地図(WorldMap)を直接描く統合テストが共有する props と、描いた物の読み方。
// 地点の印・扉の印・地点名は、村が町で地図を開く時と同じ手(src/lib/village・utils/collect-place-names.ts)で、
// index.fixture.ts が provide した村から組む。描く道具(@testing-library/react・react-dom)はここから import しない(npm run test:boundary)
import { inject } from 'vitest'
import type { Cell, Direction } from '@content/types/world'
import type { WorldMapProps } from '@/components/VillagePage/components/Village/components/WorldMap'
import { collectPlaceNames } from '@/components/VillagePage/components/Village/utils/collect-place-names'
import { fillPlace } from '@/components/VillagePage/components/Village/utils/spot-text'
import { doorMarkers } from '@/lib/village/door-marker'
import { mapEntries } from '@/lib/village/map-entries'

const { text, worldSet } = inject('villageJa')

// 地図を開ける町(屋外)
export const town = worldSet.worlds.town
export const placeNames = collectPlaceNames(worldSet, text)
// まだどこも訪ねていない時の印の並び(番号はコース順)
export const entries = mapEntries(worldSet, town, new Set())

// 地図が呼ぶ知らせ。テストが vi.fn で作って渡し、呼ばれ方を見る
export type MapHandlers = Pick<WorldMapProps, 'onTravel' | 'onTravelTo' | 'onClose'>

// 町の始まりのマスに立ち、どこも訪ねていない時の地図。閉じた時の焦点の戻り先と、スティックの向きはテストが持つ
export const mapProps = (
  handlers: MapHandlers,
  returnTo: { current: HTMLElement | null },
  scrollHeldRef: { current: Direction | null }
): WorldMapProps => ({
  world: town,
  visited: new Set(),
  player: town.start,
  destination: null,
  placeNames,
  doors: doorMarkers(worldSet, town),
  entries,
  title: text.mapTitle,
  fastTravelLabel: text.fastTravel,
  closeLabel: text.closeMap,
  ...handlers,
  returnTo,
  scrollHeldRef,
})

// 地点の印(地図の上のボタン)の読み上げ名
export const spotButtonName = (spotId: string) => fillPlace(text.fastTravel, placeNames[spotId])

// 地形を描く箱(--map-w に地図の幅を持つ)。地図の SVG と地点の印はこの箱の中にある
export const mapCanvas = (dialog: Element): HTMLElement => {
  const canvas = Array.from(dialog.querySelectorAll<HTMLElement>('div')).find(
    element => element.style.getPropertyValue('--map-w') !== ''
  )
  if (canvas === undefined) throw new Error('地図の地形の箱が無い')
  return canvas
}

// どの印からも margin マス以上(縦横どちらか)離れた町のマス。印のボタン(マスより大きい)に重ならない所を押すために使う
export const cellAwayFromSpots = (margin: number): Cell => {
  const cells = town.tiles.flatMap((row, y) => row.map((_, x) => ({ x, y })))
  const cell = cells.find(candidate =>
    entries.every(
      entry =>
        Math.max(Math.abs(entry.cell.x - candidate.x), Math.abs(entry.cell.y - candidate.y)) >=
        margin
    )
  )
  if (cell === undefined) throw new Error(`どの印からも ${margin} マス離れたマスが町に無い`)
  return cell
}

// 地形の箱の中で、マスの中心にあたる位置(箱の左上からの px)
export const cellPosition = (canvas: HTMLElement, cell: Cell) => {
  const box = canvas.getBoundingClientRect()
  return {
    x: ((cell.x + 0.5) / town.width) * box.width,
    y: ((cell.y + 0.5) / town.height) * box.height,
  }
}
