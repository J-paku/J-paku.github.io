// 舞台(黒地)に収まる整数マス寸法を実測から決める。計算は純粋関数に分け、
// フックは ResizeObserver の結果を --cell へ書くだけ。React state は使わず再レンダーを起こさない
import { useEffect } from 'react'
import type { RefObject } from 'react'

// 画面に映すのは常にこの10×9マスだけ。ワールドがいくら広くてもマスの大きさは変わらない
export const VIEW_COLS = 10
export const VIEW_ROWS = 9

// 小さすぎると操作不能、大きすぎると PC で原寸(64px)を超えてぼやける。
// 上限は表示枠(10列)で 64px。列数を増やして呼ばれた場合は「同じ横幅」を上限に保つ
export const CELL_MIN = 12
export const CELL_MAX = 64
export const REF_COLS = 10
export const cellMax = (cols: number): number => Math.floor((CELL_MAX * REF_COLS) / cols)

// 舞台の幅・高さと、縦持ちで枠の下に置く十字キー帯の高さから 1 マスの px を返す。
// 小数マスは隣接スプライトに 1px の隙間を生むので必ず整数へ切り捨てる
export const computeCell = (
  rootW: number,
  rootH: number,
  bandH: number,
  cols: number,
  rows: number
): number => {
  const byWidth = Math.floor(rootW / cols)
  const byHeight = Math.floor((rootH - bandH) / rows)
  return Math.min(cellMax(cols), Math.max(CELL_MIN, Math.min(byWidth, byHeight)))
}

// プレイヤーを置く表示枠内の位置。10列なら左から5番目、9行なら上から5番目のマス
const VIEW_FOCUS = 4

// 1軸分のカメラ原点(マス単位・小数のまま)。ワールドが表示枠より広ければ端で止め、狭ければ中央に寄せる
const axisOffset = (worldSize: number, viewSize: number, focus: number): number => {
  // 表示枠に収まるワールドは動かさず中央へ。原点は負になり、余りは黒地のまま残す
  if (worldSize <= viewSize) {
    const margin = Math.floor((viewSize - worldSize) / 2)
    // -0 を返さない(比較・文字列化で扱いが割れる)
    return margin === 0 ? 0 : -margin
  }
  // ここでマス単位に丸めると1マス分(64px)まとめて飛び、歩くたびに画面が跳ねる。
  // 補間座標のまま返し、px へ落とすときに1回だけ整数へ寄せる(継ぎ目の1px対策)
  const desired = focus - VIEW_FOCUS
  return Math.min(Math.max(desired, 0), worldSize - viewSize)
}

// 追従カメラの原点をマス単位で返す。px 換算と整数丸めは描画側が1回だけ行う
export const cameraOffset = (
  world: { width: number; height: number },
  focus: { x: number; y: number }
): { x: number; y: number } => ({
  x: axisOffset(world.width, VIEW_COLS, focus.x),
  y: axisOffset(world.height, VIEW_ROWS, focus.y),
})

// カメラが目標へ寄る時定数(ms)。1マスの歩行は256msなので、70msなら1歩の1/4ほどで収まる。
// 遅れは常に半マス未満に留まり「カメラが置いていかれる」ようには見えない
export const CAM_TAU = 70
// この差を超えたら補間しない。ワープや地図移動は町を横切ってスライドせず一瞬で切り替える
export const CAM_SNAP_CELLS = 1.5
// 残差がサブピクセル(マス上限64px基準で半px)を切ったら目標へ吸着。いつまでも微動させない
const CAM_SNAP_EPSILON = 1 / (CELL_MAX * 2)

// 現在のカメラ原点を目標へ指数的に近づける純粋関数。フレーム間隔が揺れても同じ時間で同じ位置へ着く
export const approachCamera = (
  current: { x: number; y: number },
  target: { x: number; y: number },
  dtMs: number
): { x: number; y: number } => {
  const dx = target.x - current.x
  const dy = target.y - current.y
  // 片方でも大きく離れたら両軸とも即座に目標へ(斜めに引きずられないよう軸を揃える)
  if (Math.abs(dx) > CAM_SNAP_CELLS || Math.abs(dy) > CAM_SNAP_CELLS) {
    return { x: target.x, y: target.y }
  }
  // 1 - exp(-dt/τ) はフレーム分割に対して合成が成り立つ。60fpsでも30fpsでも軌跡は変わらない
  const ratio = 1 - Math.exp(-Math.max(dtMs, 0) / CAM_TAU)
  return {
    x: Math.abs(dx) < CAM_SNAP_EPSILON ? target.x : current.x + dx * ratio,
    y: Math.abs(dy) < CAM_SNAP_EPSILON ? target.y : current.y + dy * ratio,
  }
}

export type StageScaleOptions = {
  // --cell を書き込む要素(舞台いっぱいの .root)
  root: RefObject<HTMLDivElement | null>
  // 縦持ちで枠の下に置く十字キー帯。横持ち・PC では absolute か非表示なので高さ 0 として扱う
  band: RefObject<HTMLDivElement | null>
  cols: number
  rows: number
}

// 帯が通常フローにいる(縦持ち)ときだけ高さを差し引く。absolute / display:none は 0
const bandHeight = (band: HTMLDivElement | null): number => {
  if (band === null) return 0
  return getComputedStyle(band).position === 'static' ? band.offsetHeight : 0
}

export function useStageScale({ root, band, cols, rows }: StageScaleOptions): void {
  useEffect(() => {
    const rootEl = root.current
    if (rootEl === null) return
    const apply = () => {
      const cell = computeCell(
        rootEl.clientWidth,
        rootEl.clientHeight,
        bandHeight(band.current),
        cols,
        rows
      )
      rootEl.style.setProperty('--cell', `${cell}px`)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(rootEl)
    if (band.current !== null) observer.observe(band.current)
    return () => observer.disconnect()
  }, [root, band, cols, rows])
}
