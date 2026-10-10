// 自動移動の直線飛行。経路から着地するマスを決め、出発から着地までを時間で進める。
// 曲線・高さ・時間の数値は flight-curve.ts が持ち、ここは経路と状態への当てはめだけを持つ
import type { Cell, Direction, World } from '@content/types/world'
import { isWalkable } from './collision'
import { FLIGHT_MIN_DISTANCE, flightDurationMs } from './flight-curve'

// 飛んでいる最中の状態。elapsedMs は飛び立ってからの経過で、durationMs に届いた歩みで着地する
export type Flight = { from: Cell; to: Cell; durationMs: number; elapsedMs: number }

// 飛び立つ時に決まるもの。rest は着地した後に歩いて辿る残りの経路(壁の扉へぶつかる最後の1歩)
export type FlightPlan = { flight: Flight; facing: Direction; rest: Cell[] }

// 1歩みぶん進めた結果。着地した歩みでは着地したマスを返す
export type FlightTick = { landed: false; flight: Flight } | { landed: true; cell: Cell }

// 飛ぶ間の向き。差の大きい軸で決め、同じなら左右を選ぶ。出発と着地が同じマスなら右
export const flightFacing = (from: Cell, to: Cell): Direction => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  // 符号を1つの比較で見る。軸ごとに比べると、差が0になり得ない縦の軸で比較の境目が意味を持たなくなる
  const toward = horizontal ? dx : dy
  if (toward < 0) return horizontal ? 'left' : 'up'
  return horizontal ? 'right' : 'down'
}

// 経路のうち歩いて立てる最後のマスへ飛ぶ。壁の扉へ向かう経路は扉の隣へ降り、扉への1歩は rest に残す。
// 立てるマスが無い・出発から直線で FLIGHT_MIN_DISTANCE マスに届かないなら飛ばない(null)。
// 途中のマスは見ない(屋根や木の上を越える)。startMs は前のマスから持ち越した時間
export const planFlight = (
  world: World,
  from: Cell,
  route: readonly Cell[],
  startMs: number
): FlightPlan | null => {
  const landing = route.findLastIndex(cell => isWalkable(world, cell))
  if (landing < 0) return null
  const to = route[landing]
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  if (distance < FLIGHT_MIN_DISTANCE) return null
  return {
    flight: { from, to, durationMs: flightDurationMs(distance), elapsedMs: startMs },
    facing: flightFacing(from, to),
    rest: route.slice(landing + 1),
  }
}

// 経過を足し、飛ぶ時間に届いた歩みで着地のマスを返す。着地を過ぎた余りの時間は返さない
// (着地の後に歩き出すことは無いので使い道が無い。advanceFlight を参照)
export const tickFlight = (flight: Flight, elapsedMs: number): FlightTick => {
  const elapsed = flight.elapsedMs + elapsedMs
  if (elapsed < flight.durationMs)
    return { landed: false, flight: { ...flight, elapsedMs: elapsed } }
  return { landed: true, cell: flight.to }
}
