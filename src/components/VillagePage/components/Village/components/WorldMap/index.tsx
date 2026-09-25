// 全地点を選んで素早く移動できる焦点管理付き拡大地図
'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from 'react'

import type { Cell, Direction, World } from '@content/types/world'
import type { DoorMarker } from '@/lib/village/door-marker'

import { useHeldDirection } from '../../hooks/use-held-direction'
import { MapSvg } from './map-svg'
import { spotToward } from './utils/spot-navigation'
import styles from './world-map.module.css'

export type WorldMapProps = {
  world: World
  visited: ReadonlySet<string>
  player: Cell
  destination: Cell | null
  placeNames: Record<string, string>
  doors: readonly DoorMarker[]
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
// 地図の中で焦点を地点から地点へ移す方向キー
const ARROW_DIRECTIONS: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

// スティックを倒し続けた間、焦点を次の地点へ移し直す間隔(ms)。卓上時計の 1 段目(CHOOSE_REPEAT_MS)と
// 同じ長さにし、地点が 1 つずつ移るのを目で追って手を離せるようにする
const SPOT_REPEAT_MS = 300

type LabelBox = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>

const labelsOverlap = (a: LabelBox, b: LabelBox) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

// 地点のラベルどうしの重なりを実測で解く。ラベルは折り返さないので、狭い画面では長い名前が隣のラベルの下へ潜る。
// 1 回目: 重なった組の後ろ側(world.spots の順で後の地点)のラベルを上下反対へ回す。
// 2 回目: 回してもまだ前の地点のラベルと重なるものは隠す(焦点・ポインタが乗った時だけ出る。CSS 側)。
// 結果はボタンの data-label へ DOM で直接書く。React state を経由しないので、測り直しで再描画は起きない
const arrangeSpotLabels = (panel: HTMLElement) => {
  const spots = Array.from(panel.querySelectorAll<HTMLElement>('[data-spot-id]'))
  for (const spot of spots) delete spot.dataset.label

  const measure = () => spots.map(spot => spot.firstElementChild?.getBoundingClientRect() ?? null)

  const first = measure()
  const flipped = new Set<number>()
  first.forEach((box, later) => {
    if (box === null) return
    const hit = first.some(
      (other, earlier) => earlier < later && other !== null && labelsOverlap(other, box)
    )
    if (hit) flipped.add(later)
  })
  for (const index of flipped) spots[index].dataset.label = 'flip'
  if (flipped.size === 0) return

  // 反転の書き込み後に測り直す(getBoundingClientRect が同期でレイアウトを確定させる)
  const second = measure()
  const shown: LabelBox[] = []
  second.forEach((box, index) => {
    if (box === null) return
    if (shown.some(other => labelsOverlap(other, box))) {
      spots[index].dataset.label = 'hidden'
      return
    }
    shown.push(box)
  })
}

export function WorldMap({
  world,
  visited,
  player,
  destination,
  placeNames,
  doors,
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
  const panelRef = useRef<HTMLDivElement>(null)
  const firstSpotRef = useRef<HTMLButtonElement>(null)
  // スティックを倒し続けた時に次の地点へ移す rAF 時刻。押した瞬間に置き、空の間は繰り返さない
  const repeatAtRef = useRef<number | null>(null)

  useEffect(() => {
    const returnTarget = returnTo.current
    firstSpotRef.current?.focus()

    return () => {
      returnTarget?.focus()
    }
  }, [returnTo])

  // 地図が描かれた直後(描画前)に 1 回、以後は画面の大きさが変わるたびに 1 フレームへまとめて 1 回測る。
  // 字形の読み込みでラベルの幅が変わるので、フォントが揃った時にももう 1 回測る
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (panel === null) return

    arrangeSpotLabels(panel)
    let frame: number | null = null
    let active = true
    const handleResize = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        arrangeSpotLabels(panel)
      })
    }
    window.addEventListener('resize', handleResize)
    void document.fonts.ready.then(() => {
      if (active) arrangeSpotLabels(panel)
    })

    return () => {
      active = false
      window.removeEventListener('resize', handleResize)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [world, placeNames])

  // 今の焦点の地点から、その向きで最も近い地点へ焦点を移す。キー以外の入力からも呼べるよう keydown とは分けてある
  const focusSpotToward = (direction: Direction) => {
    const active = document.activeElement
    const currentId = active instanceof HTMLElement ? (active.dataset.spotId ?? null) : null
    const next = spotToward(world.spots, currentId, direction)
    if (next === null) return
    panelRef.current?.querySelector<HTMLElement>(`[data-spot-id='${next.id}']`)?.focus()
  }

  // スティックの押しっぱなし。押した瞬間に 1 地点移し、倒し続ければ一定の間隔で繰り返す。
  // この地図は村の枠([data-village])の外の兄弟なので、方向キーは枠の onKeyDown(押しっぱなしの ref へ書く経路)へ
  // 届かず下の handleKeyDown だけが受ける。ref へ書くのはスティックだけになり、キーとスティックが二重に動かすことはない
  useHeldDirection({
    heldRef: scrollHeldRef,
    onHeld: (direction, pressed, now) => {
      const repeatAt = repeatAtRef.current
      if (!pressed && (repeatAt === null || now < repeatAt)) return
      repeatAtRef.current = now + SPOT_REPEAT_MS
      focusSpotToward(direction)
    },
  })

  // 地点のボタン以外の所を押したら、押した位置のマスへ歩く。
  // SVG は mapCanvas いっぱいに伸びているので、枠に対する割合がそのままマスの割合になる
  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button') !== null) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    // 右端・下端ちょうど(小数ピクセルの境目)を押すと割合が 1 になり枠外のマスを指すので、端のマスへ収める
    const x = Math.min(
      world.width - 1,
      Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * world.width))
    )
    const y = Math.min(
      world.height - 1,
      Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * world.height))
    )
    onTravelTo({ x, y })
  }

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

    const direction = ARROW_DIRECTIONS[event.key]
    if (direction !== undefined) {
      event.preventDefault()
      focusSpotToward(direction)
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
          <div className={styles.mapCanvas} style={mapCanvasStyle} onClick={handleCanvasClick}>
            <MapSvg
              world={world}
              scale={SCALE}
              visited={visited}
              player={player}
              destination={destination}
              spotIds={Object.keys(placeNames)}
              doors={doors}
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
                  data-spot-id={spot.id}
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
