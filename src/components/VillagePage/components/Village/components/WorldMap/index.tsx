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
import type { MapEntry } from '@/lib/village/map-entries'

import { useHeldDirection } from '../../hooks/use-held-direction'
import { CHECK_GLYPH, MapSvg, MARKER_COLORS, PLATE_CELLS, QUESTION_GLYPH } from './map-svg'
import { spotToward } from './utils/spot-navigation'
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

// 印(✓/? の字 + 右上の番号の札)どうしに空ける最小の隙間(px)
const BADGE_GAP = 6

type BadgeBox = {
  left: number
  right: number
  top: number
  bottom: number
}

const badgesTouch = (a: BadgeBox, b: BadgeBox) =>
  a.left < b.right + BADGE_GAP &&
  b.left < a.right + BADGE_GAP &&
  a.top < b.bottom + BADGE_GAP &&
  b.top < a.bottom + BADGE_GAP

const centerOf = (box: BadgeBox) => ({
  x: (box.left + box.right) / 2,
  y: (box.top + box.bottom) / 2,
})

// 向き(-1 / +1)へ、a に触れなくなるまで b を動かす量。0 の差は +1(右・下)とみなす
const clearance = (a: BadgeBox, b: BadgeBox, axis: 'x' | 'y', sign: number) => {
  if (axis === 'x') return sign > 0 ? a.right + BADGE_GAP - b.left : a.left - BADGE_GAP - b.right
  return sign > 0 ? a.bottom + BADGE_GAP - b.top : a.top - BADGE_GAP - b.bottom
}

const shifted = (box: BadgeBox, axis: 'x' | 'y', amount: number): BadgeBox =>
  axis === 'x'
    ? { ...box, left: box.left + amount, right: box.right + amount }
    : { ...box, top: box.top + amount, bottom: box.bottom + amount }

const insideBox = (box: BadgeBox, frame: BadgeBox) =>
  box.left >= frame.left &&
  box.right <= frame.right &&
  box.top >= frame.top &&
  box.bottom <= frame.bottom

// 隣り合うマスの地点(AIロボと焚き火など)は印が重なるので、実測で後の番号の印をずらす。
// 印は字と札を合わせた範囲(ボタンの子の外接矩形。札はボタンの外へはみ出す)で測る。
// 印は番号の順(= entries の順)に置き、前の印 a に触れる印 b は a から b へ向かう向きへ押し出す
// (池のように左下にある地点は左下へ逃げ、元の場所の近くに残る)。中心の差の大きい軸を先に試し、
// 地図の外へ出るなら他方の軸へ。どちらも外なら先の軸のまま置く。
// ずらした量はボタンの --nudge-x / --nudge-y へ DOM で直接書く。字・札・押せる範囲がボタンごと一緒に動く
const arrangeBadges = (canvas: HTMLElement) => {
  const spots = Array.from(canvas.querySelectorAll<HTMLElement>('[data-spot-id]'))
  for (const spot of spots) {
    spot.style.removeProperty('--nudge-x')
    spot.style.removeProperty('--nudge-y')
  }

  // ずらしを外した後に測る(getBoundingClientRect が同期でレイアウトを確定させる)
  const canvasRect = canvas.getBoundingClientRect()
  const frame: BadgeBox = {
    left: canvasRect.left,
    right: canvasRect.right,
    top: canvasRect.top,
    bottom: canvasRect.bottom,
  }
  const placed: BadgeBox[] = []
  for (const spot of spots) {
    const rects = Array.from(spot.children).map(child => child.getBoundingClientRect())
    if (rects.length === 0) continue
    const origin: BadgeBox = {
      left: Math.min(...rects.map(rect => rect.left)),
      right: Math.max(...rects.map(rect => rect.right)),
      top: Math.min(...rects.map(rect => rect.top)),
      bottom: Math.max(...rects.map(rect => rect.bottom)),
    }
    let box = origin
    // ずらす回数は置いた印の数 + 1 までで打ち切る(行き場が無い時に回り続けないため)
    let steps = placed.length + 1
    while (steps > 0) {
      steps -= 1
      const hit = placed.find(other => badgesTouch(other, box))
      if (hit === undefined) break
      const from = centerOf(hit)
      const to = centerOf(box)
      const dx = to.x - from.x
      const dy = to.y - from.y
      const signX = dx < 0 ? -1 : 1
      const signY = dy < 0 ? -1 : 1
      const first = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      const second = first === 'x' ? 'y' : 'x'
      const sign = (axis: 'x' | 'y') => (axis === 'x' ? signX : signY)
      const tryFirst = shifted(box, first, clearance(hit, box, first, sign(first)))
      const trySecond = shifted(box, second, clearance(hit, box, second, sign(second)))
      box = insideBox(tryFirst, frame) || !insideBox(trySecond, frame) ? tryFirst : trySecond
    }
    placed.push(box)
    const nudgeX = box.left - origin.left
    const nudgeY = box.top - origin.top
    if (nudgeX !== 0) spot.style.setProperty('--nudge-x', `${nudgeX}px`)
    if (nudgeY !== 0) spot.style.setProperty('--nudge-y', `${nudgeY}px`)
  }
}

type SpotGlyphProps = {
  visited: boolean
}

// 地点のボタンの中の ✓/? の字(9 ドット角の SVG、1 ドット = 1 単位)。黒い縁・白い下敷き・訪問済みは緑の ✓、未訪問は黒の ?。
// 地図の SVG ではなくボタンの中に描くので、arrangeBadges が札と一緒にずらせる。画面上の大きさは .glyph が決める
function SpotGlyph({ visited }: SpotGlyphProps) {
  const glyph = visited ? CHECK_GLYPH : QUESTION_GLYPH
  const inkColor = visited ? MARKER_COLORS.visited : MARKER_COLORS.unvisited

  return (
    <svg
      className={styles.glyph}
      viewBox={`0 0 ${PLATE_CELLS} ${PLATE_CELLS}`}
      shapeRendering='crispEdges'
      aria-hidden='true'
    >
      <rect width={PLATE_CELLS} height={PLATE_CELLS} fill={MARKER_COLORS.plateEdge} />
      <rect
        x={1}
        y={1}
        width={PLATE_CELLS - 2}
        height={PLATE_CELLS - 2}
        fill={MARKER_COLORS.plate}
      />
      {glyph.flatMap((row, rowIndex) =>
        row
          .split('')
          .flatMap((pixel, colIndex) =>
            pixel === '#'
              ? [
                  <rect
                    key={`${colIndex}-${rowIndex}`}
                    x={colIndex + 1}
                    y={rowIndex + 1}
                    width={1}
                    height={1}
                    fill={inkColor}
                  />,
                ]
              : []
          )
      )}
    </svg>
  )
}

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
  const panelRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
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

  // 札の置き場所が変わった時だけ測り直す(entries は描き直しのたびに別の配列になり得るので、中身の文字列で比べる)
  const badgeLayoutKey = entries
    .map(entry => `${entry.id}:${entry.cell.x},${entry.cell.y}`)
    .join('|')

  // 地図が描かれた直後(描画前)に 1 回、以後は画面の大きさ・向きが変わるたびに 1 フレームへまとめて 1 回測る
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return

    arrangeBadges(canvas)
    let frame: number | null = null
    const handleResize = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        arrangeBadges(canvas)
      })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [badgeLayoutKey, world])

  // 今の焦点の地点から、その向きで最も近い地点へ焦点を移す。キー以外の入力からも呼べるよう keydown とは分けてある
  const focusSpotToward = (direction: Direction) => {
    const active = document.activeElement
    const currentId = active instanceof HTMLElement ? (active.dataset.spotId ?? null) : null
    const next = spotToward(entries, currentId, direction)
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
            {entries.map((entry, index) => {
              // SVG が流動的に伸縮しても揃うよう、px ではなく mapCanvas に対する割合で置く
              const position: SpotPosition = {
                '--spot-x': `${((entry.cell.x + 0.5) / world.width) * 100}%`,
                '--spot-y': `${((entry.cell.y + 0.5) / world.height) * 100}%`,
              }

              return (
                <button
                  key={entry.id}
                  ref={index === 0 ? firstSpotRef : undefined}
                  type='button'
                  className={styles.spot}
                  style={position}
                  data-spot-id={entry.id}
                  aria-label={fastTravelLabel.replace('{place}', placeNames[entry.id])}
                  onClick={() => onTravel(entry.id)}
                >
                  <SpotGlyph visited={entry.visited} />
                  <span className={styles.badge} data-visited={entry.visited ? 'true' : undefined}>
                    {entry.number}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {/* 地図の番号と地点の名前の対応表。地図の中に字を置くと名前どうしが重なるので、名前はここにだけ出す。
            焦点の方向移動の対象は地図の札だけなので、ここのボタンには data-spot-id を付けない */}
        <ol className={styles.legend}>
          {entries.map(entry => (
            <li key={entry.id}>
              <button
                type='button'
                className={styles.legendItem}
                onClick={() => onTravel(entry.id)}
              >
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
      </div>
    </div>
  )
}

export default WorldMap
