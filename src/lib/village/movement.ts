// 移動状態の遷移。時間は呼び出し側(rAF)が渡す。1ステップで新しく始めるのは最大1マス —
// 長いフレームで壁を飛び越えないための上限。マスをまたいだ余りの時間は次のマスへ持ち越す
import type { Cell, Direction, World } from '@content/types/world'
import { isWalkable } from './collision'
import { advanceFlight, takeOff, type Flight } from './flight'

export type Motion = { from: Cell; to: Cell; progress: number }
export type MoveState = {
  cell: Cell
  facing: Direction
  motion: Motion | null
  route: Cell[]
  fast: boolean
  // 経路の最初の1歩を決める時に飛んでよいか。経路と一緒に受け取り、判定した時点で使い切る
  fly: boolean
  // 飛んでいる最中だけ値を持つ。その間 motion は null のまま
  flight: Flight | null
  turnRemainingMs: number
  stride: 0 | 1
}
export type MoveInput = {
  held: Direction | null
  route: Cell[] | null
  fast: boolean
  fly: boolean
}
export type StepResult = { state: MoveState; arrived: Cell | null; bumped: Cell | null }

// 歩行は 1 マス 256ms。携帯機RPGの歩行(16フレーム≒267ms)に合わせる
export const CELL_MS = 256
// 短押しは向きだけ変え、押し続けた時に歩き始める
export const TURN_MS = 64
// 地図からの高速移動は 1 マス 128ms(自転車相当)
export const FAST_DIVISOR = 2

const OFFSET: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const createMoveState = (world: World): MoveState => ({
  cell: world.start,
  facing: world.startFacing,
  motion: null,
  route: [],
  fast: false,
  fly: false,
  flight: null,
  turnRemainingMs: 0,
  stride: 0,
})

const cellMsOf = (fast: boolean): number => (fast ? CELL_MS / FAST_DIVISOR : CELL_MS)

export const directionTo = (from: Cell, to: Cell): Direction => {
  if (to.y < from.y) return 'up'
  if (to.y > from.y) return 'down'
  if (to.x < from.x) return 'left'
  return 'right'
}

// progress は持ち越した余剰時間ぶんの進捗。通常フレームの開始は 0
const begin = (world: World, state: MoveState, to: Cell, progress: number): MoveState => {
  const facing = directionTo(state.cell, to)
  if (!isWalkable(world, to)) return { ...state, facing }
  return { ...state, facing, turnRemainingMs: 0, motion: { from: state.cell, to, progress } }
}

// 止まっているマスから次の1マスを決めて始める。到着フレームの連結にも同じ判断を使う。
// carryMs は持ち越した余剰時間(ms)で、飛び立つ時の経過に使う(progress はその歩行での進捗)。
// 入力から読むのは押している向きだけ(経路・速度・飛んでよいかは step が状態へ移してから呼ぶ)
const startNext = (
  world: World,
  state: MoveState,
  input: Pick<MoveInput, 'held'>,
  elapsedMs: number,
  progress: number,
  carryMs: number
): { state: MoveState; bumped: Cell | null } => {
  let next = state
  if (input.held !== null) {
    const off = OFFSET[input.held]
    const to = { x: next.cell.x + off.x, y: next.cell.y + off.y }
    if (isWalkable(world, to)) {
      if (next.facing !== input.held) {
        return { state: { ...next, facing: input.held, turnRemainingMs: TURN_MS }, bumped: null }
      }
      const remaining = Math.max(0, next.turnRemainingMs - elapsedMs)
      next = { ...next, turnRemainingMs: remaining }
      if (remaining > 0) return { state: next, bumped: null }
    }
    const begun = begin(world, next, to, progress)
    // 通れないマスへ向いたときは向きだけ変え、ぶつかった先を返す(会話の起点に使う)
    return { state: begun, bumped: begun.motion === null ? to : null }
  }
  // 離した後の再入力に旋回待ちを持ち越さない
  next = { ...next, turnRemainingMs: 0 }
  if (next.route.length > 0) {
    const [head, ...rest] = next.route
    // 経路の先頭が隣接マスでなければ経路ごと捨てる(瞬間移動を防ぐ防御。findPath 由来なら起きない)
    if (Math.abs(head.x - next.cell.x) + Math.abs(head.y - next.cell.y) !== 1) {
      return { state: { ...next, route: [] }, bumped: null }
    }
    // 飛んでよい経路は最初の1歩を決める時だけ飛ぶかを判定し、許可を使い切る(途中のマスから飛び立たない)
    const launched = takeOff(world, next, carryMs)
    if (launched !== null) return { state: launched, bumped: null }
    const started = begin(world, { ...next, route: rest, fly: false }, head, progress)
    // 進めない経路は捨てるが、ぶつかった先は返す(扉へ向かう経路の最後の1歩をワープに使う)
    if (started.motion === null) return { state: { ...started, route: [] }, bumped: head }
    return { state: started, bumped: null }
  }
  return { state: next, bumped: null }
}

// 着地した歩みの連結では押した向きを読まない(飛んでいる間の入力の錠は着地の歩みまで続く)
const LANDING_INPUT: Pick<MoveInput, 'held'> = { held: null }

// 飛んでいる間はキーも新しい経路も読まず、通り過ぎるマスの当たり判定・到着もしない(進め方は advanceFlight)。
// 着地した歩みで着地したマスを1回だけ返し、同じ歩みで残りの経路を辿る。残りの経路は通れないマスだけなので
// 扉へぶつかるか止まるかで終わり、歩き出さない。着地を過ぎた余りの時間は持ち越す先が無いので 0 を渡す
const flyStep = (world: World, state: MoveState, flight: Flight, elapsedMs: number): StepResult => {
  const { state: next, landed } = advanceFlight(state, flight, elapsedMs)
  if (landed === null) return { state: next, arrived: null, bumped: null }
  const chained = startNext(world, next, LANDING_INPUT, 0, 0, 0)
  return { state: chained.state, arrived: landed, bumped: chained.bumped }
}

export const step = (
  world: World,
  state: MoveState,
  input: MoveInput,
  elapsedMs: number
): StepResult => {
  if (state.flight !== null) return flyStep(world, state, state.flight, elapsedMs)
  // タップ経路の差し替えは即時に記録し、消費は到着後。速度・飛んでよいかも経路と一緒に受け取る
  let next: MoveState =
    input.route !== null
      ? { ...state, route: input.route, fast: input.fast, fly: input.fly }
      : state
  // キー入力は経路より優先し、経路を捨てる。自分で歩くときは常に等速で、飛ばない
  if (input.held !== null) next = { ...next, route: [], fast: false, fly: false }

  if (next.motion !== null) {
    const cellMs = cellMsOf(next.fast)
    // 1を超えた分は切り捨てずに残す。切り捨てると1マスがフレーム境界へ丸まって速度が脈打つ
    const advanced = next.motion.progress + elapsedMs / cellMs
    if (advanced < 1)
      return {
        state: { ...next, motion: { ...next.motion, progress: advanced } },
        arrived: null,
        bumped: null,
      }
    const arrived = next.motion.to
    next = { ...next, cell: arrived, motion: null, stride: next.stride === 0 ? 1 : 0 }
    // 余剰時間は次のマスの進捗として持ち越す。呼び出し側がelapsedMsをCELL_MS未満へ抑えるので
    // 持ち越しは1マス未満に収まるが、飛び越し防止の上限として clamp も置く
    const overflowMs = Math.min((advanced - 1) * cellMs, cellMs)
    // 到着はこのステップで1回だけ返す。押し続け・経路が続くなら同じステップで次の1マスへ繋ぐ
    const chained = startNext(world, next, input, overflowMs, overflowMs / cellMs, overflowMs)
    return { state: chained.state, arrived, bumped: chained.bumped }
  }

  const begun = startNext(world, next, input, elapsedMs, 0, 0)
  return { state: begun.state, arrived: null, bumped: begun.bumped }
}
