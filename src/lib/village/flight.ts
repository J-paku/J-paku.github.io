// 自動移動の直線飛行。経路から着地するマスを決め、出発から着地までを時間で進める。
// 飛び立つ・飛んでいる1歩み・着地の移動状態の書き換えもここが持ち、movement.ts は呼ぶのと着地の後の残りの経路を辿るだけ。
// 描く側が使う表示位置・浮き上がり・影の倍率・羽ばたきのコマ・カメラの持ち上げもここで状態から引く。時間は呼び出し側(rAF)が渡す。
// 浮き上がりはワールドの上端の近くで、絵が画面の上へ出ない高さまでに抑える(flightLiftLimit)。
// 曲線・高さ・時間の数値は flight-curve.ts が持ち、ここは経路と状態への当てはめだけを持つ
import type { Cell, Direction, World } from '@content/types/world'
import { isWalkable } from './collision'
import {
  FLIGHT_LIFT_CELLS,
  FLIGHT_MIN_DISTANCE,
  flightDurationMs,
  flightEase,
  flightLift,
  flightShadowScale,
} from './flight-curve'
// movement.ts はこのファイルの関数を値で読むので、こちらからは型だけを読む(値の循環を作らない)
import type { MoveState } from './movement'

// 飛んでいる最中の状態。elapsedMs は飛び立ってからの経過で、durationMs に届いた歩みで着地する
export type Flight = { from: Cell; to: Cell; durationMs: number; elapsedMs: number }

// 飛び立つ時に決まるもの。rest は着地した後に歩いて辿る残りの経路(壁の扉へぶつかる最後の1歩)
export type FlightPlan = { flight: Flight; facing: Direction; rest: Cell[] }

// 1歩みぶん進めた結果。着地した歩みでは着地したマスを返す
export type FlightTick = { landed: false; flight: Flight } | { landed: true; cell: Cell }

// 表示の関数が読むのは飛行の有無だけなので、移動状態をそのまま渡せる形で受ける
export type Flying = { flight: Flight | null }

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

// 止まっているマスから経路の最初の1歩を決める時に、飛び立つかを決める。飛んでよい経路(fly)でなければ、
// また planFlight が飛ばないと決めたら null を返し、呼び出し側は経路の先頭へ歩く。
// 飛び立つ時は許可を使い切り、経路を着地の後に辿る残り(扉への1歩)へ置き換える。startMs は前のマスから持ち越した時間
export const takeOff = (world: World, state: MoveState, startMs: number): MoveState | null => {
  if (!state.fly) return null
  const plan = planFlight(world, state.cell, state.route, startMs)
  if (plan === null) return null
  return { ...state, fly: false, flight: plan.flight, facing: plan.facing, route: plan.rest }
}

// 経過を足し、飛ぶ時間に届いた歩みで着地のマスを返す。着地を過ぎた余りの時間は返さない
// (着地の後に歩き出すことは無いので使い道が無い。advanceFlight を参照)
export const tickFlight = (flight: Flight, elapsedMs: number): FlightTick => {
  const elapsed = flight.elapsedMs + elapsedMs
  if (elapsed < flight.durationMs)
    return { landed: false, flight: { ...flight, elapsedMs: elapsed } }
  return { landed: true, cell: flight.to }
}

// 飛んでいる最中の移動状態を1歩みぶん進める。着地した歩みでは今のマスを着地のマスへ移して飛行を終え、
// landed に着地のマスを返す(それ以外の歩みは null)。経路(route)は飛び立った時に残した分のままで、
// 呼び出し側が着地と同じ歩みで辿る。着地のマスは経路のうち立てる最後のマスなので、残りの経路は
// 通れないマスだけでできていて、ぶつかるか止まるかで終わり、歩き出すことは無い
export const advanceFlight = (
  state: MoveState,
  flight: Flight,
  elapsedMs: number
): { state: MoveState; landed: Cell | null } => {
  const tick = tickFlight(flight, elapsedMs)
  if (!tick.landed) return { state: { ...state, flight: tick.flight }, landed: null }
  return { state: { ...state, cell: tick.cell, flight: null }, landed: tick.cell }
}

// 飛んでいる最中か。歩いている間(motion)は数えない。地図を開く操作は飛んでいる間だけ止める
export const isFlying = ({ flight }: Pick<MoveState, 'flight'>): boolean => flight !== null

const ratio = (flight: Flight): number => flight.elapsedMs / flight.durationMs

const groundOf = (flight: Flight): { x: number; y: number } => {
  const eased = flightEase(ratio(flight))
  return {
    x: flight.from.x + (flight.to.x - flight.from.x) * eased,
    y: flight.from.y + (flight.to.y - flight.from.y) * eased,
  }
}

// 地上の影が落ちる位置(マス、小数)。飛んでいなければ null を返し、呼び出し側は歩行の補間を使う
export const flightPosition = ({ flight }: Flying): { x: number; y: number } | null =>
  flight === null ? null : groundOf(flight)

// 主人公の絵の上端が、立っているマスの上辺から何マス上にあるか(寸法は scene.module.css)。
// 体の箱(.player)は足をマスの下辺に揃えて上へ半マスはみ出し(top -0.5 マス・高さ 1.5 マス)、
// 絵の画布(.player::before、32×32 を 2×2 マス)はその箱からさらに半マス上へはみ出す。合わせて 1 マス
const SPRITE_OVERHANG_CELLS = 1

// 地上の位置の縦 groundY(マス、小数)で浮いてよい高さの上限(マス)。絵の上端がワールドの上端(y = 0)を越えない
// 最も高い浮き上がりで、立っているだけで越える所(上端の行)では 0。
// カメラの原点の縦は、上の端でワールドの y = 0 に止まる(縦が 8 行以上のワールド。今の町は 20 行、部屋は 8 行で、
// 部屋は表示枠の 9 行との差の 1 行を半分に切り捨てて原点が 0 のまま。stage-scale.ts の cameraOffset)。
// 止まっていない所では絵の上端が枠の上辺から 3 - h / 2 マス下(h は浮き上がり。最も高くても 1.75 マス)にあるので、
// この上限だけで足りる。縦が 7 行以下のワールドは原点が負で画面の上に余りが残り、ここは浮き上がりを控えめに抑える側へ倒れる
export const flightLiftLimit = (groundY: number): number =>
  Math.max(0, groundY - SPRITE_OVERHANG_CELLS)

// 地上から浮いている高さ(マス)。飛んでいなければ0。
// 曲線の高さ(最も高くて FLIGHT_LIFT_CELLS)を、地上の位置での上限(flightLiftLimit)で抑える。
// どちらも時間に沿って切れ目なく変わるので、小さい方を取っても浮き上がりは途中で跳ばない
export const flightLiftCells = ({ flight }: Flying): number => {
  if (flight === null) return 0
  const raised = flightLift(ratio(flight)) * FLIGHT_LIFT_CELLS
  return Math.min(raised, flightLiftLimit(groundOf(flight).y))
}

// 足元の影の倍率。飛んでいなければ等倍。上限で抑えた後の浮き上がりから決めるので、浮かない所では等倍
export const flightShadow = (state: Flying): number =>
  flightShadowScale(flightLiftCells(state) / FLIGHT_LIFT_CELLS)

// 飛んでいる間にカメラの目標を上へずらすマス数。飛んでいなければ0。
// 表示枠は縦9マスで、カメラは目標のマスの中心を枠の真ん中に置くので、見えるのは真ん中から上下4.5マス。
// 浮き上がりを h・持ち上げを c として、真ん中からの位置をマスで(上が負)書く(寸法は scene.module.css の .player・.flightShadow)。
//   絵の上端: 32×32の画布を2×2マスで描き、下端(足)は地上のマスの下辺から h だけ上、上端はその2マス上なので c - h - 1.5
//   影: 地上のマスの下辺側にあり、最も下でも c + 0.5
// c = h / 2 なら上端は -(h / 2 + 1.5)、影は h / 2 + 0.5。最も高い h = FLIGHT_LIFT_CELLS(2.5)でも
// 上端 -2.75・影 +1.75 で、どちらも上下4マス(枠の端から半マス以上の余白)に収まる。
// 持ち上げなければ(c = 0)最も高い時の上端は -4 で、余白は半マスしか残らない。
// h は上限で抑えた後の浮き上がり(flightLiftCells)。カメラが上の端で止まる所では、上限が絵の上端を枠の中に留める。
// 浮き上がりに比例させるので、飛び立ちと着地ではカメラの目標が地上の位置へ切れ目なく戻る
export const flightCameraLift = (state: Flying): number => flightLiftCells(state) / 2
