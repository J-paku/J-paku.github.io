// ポインタの入力(押しっぱなし・タップ)を経路に変えて、次のステップへ渡す置き場に入れる。
// 経路探索そのものは lib の findPath に任せ、ここは「いつ作り直すか」と「作った経路をどこへ置くか」だけを決める
import type { Cell, Direction } from '@content/types/world'
import { findPath } from '@/lib/village/path'
import type { MoveRefs, WalkFrameState } from './types'

// 押しっぱなしのポインタへ向けて経路を作り直す。目標が変わった時、または経路を使い切って
// 足が止まる時(motion も route も空 = step 内の startNext がそのまま停止を返す状態)に限る。
// 同じ目標のまま経路が残っている間は毎フレーム作り直さない(足踏みしないため)
export const replanTowardPointer = (
  frameState: WalkFrameState,
  {
    world: worldRef,
    state: stateRef,
    pendingRoute: pendingRouteRef,
    pendingFast: pendingFastRef,
    autoTalk: autoTalkRef,
    pointerTarget: pointerTargetRef,
  }: MoveRefs,
  held: Direction | null
): void => {
  const pointerTarget = frameState.staleTarget ? null : pointerTargetRef.current
  if (pointerTarget !== null && held === null) {
    const s = stateRef.current
    const planned = frameState.plannedTarget
    const changed =
      planned === null || planned.x !== pointerTarget.x || planned.y !== pointerTarget.y
    if (changed || (s.route.length === 0 && s.motion === null)) {
      const route = findPath(worldRef.current, s.cell, pointerTarget)
      frameState.plannedTarget = pointerTarget
      if (route !== null && route.length > 0) {
        pendingRouteRef.current = route
        pendingFastRef.current = false
        // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
        autoTalkRef.current = false
      }
    }
  } else if (pointerTargetRef.current === null) {
    frameState.plannedTarget = null
  }
}

// タップ → 経路を作って次のステップへ渡す。通れない場所は無視。
// 経路を置いた時だけ true を返し、呼ぶ側はその時だけループを起こす
export const queueTapRoute = (
  {
    world: worldRef,
    state: stateRef,
    pendingRoute: pendingRouteRef,
    pendingFast: pendingFastRef,
    autoTalk: autoTalkRef,
  }: Pick<MoveRefs, 'world' | 'state' | 'pendingRoute' | 'pendingFast' | 'autoTalk'>,
  tapped: Cell
): boolean => {
  const route = findPath(worldRef.current, stateRef.current.cell, tapped)
  if (route !== null && route.length > 0) {
    pendingRouteRef.current = route
    pendingFastRef.current = false
    // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
    autoTalkRef.current = false
    return true
  }
  return false
}
