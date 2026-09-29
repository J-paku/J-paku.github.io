// ポインタの入力(押しっぱなし・タップ)を経路に変えて、次のステップへ渡す置き場に入れる。
// 経路探索そのものは lib の routeToCell に任せ、ここは「いつ作り直すか」と「作った経路をどこへ置くか」だけを決める
// (地点の物を押したタップはlibのobjectSpotAt・routeToSpotで話しかけるマスまでの経路にする)
import type { Cell, Direction, Spot } from '@content/types/world'
import { objectSpotAt, routeToSpot } from '@/lib/village/spot'
import { routeToCell } from '@/lib/village/warp'
import type { MoveRefs, WalkFrameState } from './types'

// 押しっぱなしのポインタへ向けて経路を作り直す。目標が変わった時、または経路を使い切って
// 足が止まる時(motion も route も空 = step 内の startNext がそのまま停止を返す状態)に限る。
// 同じ目標のまま経路が残っている間は毎フレーム作り直さない(足踏みしないため)。
// 違う目標へ経路を実際に置いた時だけ retarget で知らせる(行き先の印を指先のマスへ動かすため)。
// 呼ぶのは向かうマスが変わった時の 1 回だけで毎フレームではない — state を触るのが到着時と同じ頻度に収まる。
// 通れないマス(経路が null)へ指を動かした時は知らせず、前の経路と印をそのまま残す
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
  held: Direction | null,
  retarget: (cell: Cell) => void
): void => {
  const pointerTarget = frameState.staleTarget ? null : pointerTargetRef.current
  if (pointerTarget !== null && held === null) {
    const s = stateRef.current
    const planned = frameState.plannedTarget
    const changed =
      planned === null || planned.x !== pointerTarget.x || planned.y !== pointerTarget.y
    if (changed || (s.route.length === 0 && s.motion === null)) {
      // 次のマスへ歩いている途中なら、そのマスから経路を作る。出発マスから作ると先頭が向かっているマス自身になり、
      // 着いた時に「隣接でない先頭」として経路ごと捨てられて次のマスで止まってしまう
      const from = s.motion !== null ? s.motion.to : s.cell
      const route = routeToCell(worldRef.current, from, pointerTarget)
      frameState.plannedTarget = pointerTarget
      // 向かっているマスそのものが目標なら経路は空。残りの経路を空で差し替え、着いた所で止める
      if (route !== null && (route.length > 0 || s.motion !== null)) {
        pendingRouteRef.current = route
        pendingFastRef.current = false
        // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
        autoTalkRef.current = false
        if (changed) retarget(pointerTarget)
      }
    }
  } else if (pointerTargetRef.current === null) {
    frameState.plannedTarget = null
  }
}

// タップの結果。walkは経路を置いた(goalに行き先の印を立てる)、talkはもう物に話しかけられるマスに止まっていて、
// 歩かずにその地点へ話しかける
type TapPlan = { kind: 'walk'; goal: Cell } | { kind: 'talk'; spot: Spot }

// タップ → 経路を作って次のステップへ渡す。通れない場所は無視(壁の扉は隣まで歩いてぶつかる)。
// 地点の物(机・ロボット・家の壁など)を押した時は、話しかけられるマスのうち最短の所まで歩き、
// 着いたら話しかける(autoTalk。次へと同じく到着の処理が開く)。水・木・地点の無い物は無視。
// 経路を置いた時だけwalkを返し、呼ぶ側はその時だけループを起こす
export const queueTapRoute = (
  {
    world: worldRef,
    state: stateRef,
    pendingRoute: pendingRouteRef,
    pendingFast: pendingFastRef,
    autoTalk: autoTalkRef,
  }: Pick<MoveRefs, 'world' | 'state' | 'pendingRoute' | 'pendingFast' | 'autoTalk'>,
  tapped: Cell
): TapPlan | null => {
  // 移動中は向かっているマスから経路を作る(理由は replanTowardPointer と同じ)
  const s = stateRef.current
  const from = s.motion !== null ? s.motion.to : s.cell
  const route = routeToCell(worldRef.current, from, tapped)
  // 向かっているマスそのものをタップした時は経路が空でも「そのマスへ行く」ので、残りの経路を空で差し替えてwalkを返す
  if (route !== null && (route.length > 0 || s.motion !== null)) {
    pendingRouteRef.current = route
    pendingFastRef.current = false
    // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
    autoTalkRef.current = false
    return { kind: 'walk', goal: tapped }
  }
  const spot = objectSpotAt(worldRef.current, tapped)
  const talkRoute = spot === null ? null : routeToSpot(worldRef.current, from, spot)
  if (spot === null || talkRoute === null) return null
  if (talkRoute.length === 0 && s.motion === null) {
    // 前に置いた自動の会話は、このタップで置き換える
    autoTalkRef.current = false
    return { kind: 'talk', spot }
  }
  // 話しかけるマスへ向かっている途中なら経路は空。残りの経路を空で差し替え、着いた所で話しかける
  pendingRouteRef.current = talkRoute
  pendingFastRef.current = false
  autoTalkRef.current = true
  return { kind: 'walk', goal: talkRoute.at(-1) ?? from }
}
