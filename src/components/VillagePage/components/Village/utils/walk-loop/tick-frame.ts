// 1 フレーム分の入力を消費して歩みを 1 回進め、その結果を到着・衝突として外へ知らせる。
// 移動規則そのものは lib の step に任せ、ここは「どの入力を今は捨てるか」と「もう眠ってよいか」を決める。
// 捨てる判定(ワープ直後の押しっぱなし)は入力側では決められない — ワールドが替わったことを知るのはこのループだけ
import type { Cell } from '@content/types/world'
import { step } from '@/lib/village/movement'
import { replanTowardPointer } from './route-pointer'
import type { MoveRefs, WalkFrameState } from './types'

// 1 フレームの中で呼び出す、フック側の処理
export type FrameSteps = {
  // 人物のコマだけを書き直す。まだコマが時間で変わるなら true
  applyPose: () => boolean
  // 1 フレーム分を描く。描き終えて時間で変わるものが残っていなければ true
  paint: (dtMs: number) => boolean
  arrive: (cell: Cell) => void
  bump: (cell: Cell) => void
}

// 1 フレーム分進めて描く。まだ時間で変わるもの・読むべき入力が残っていれば true
export const tickFrame = (
  frameState: WalkFrameState,
  refs: MoveRefs,
  { applyPose, paint, arrive, bump }: FrameSteps,
  elapsed: number
): boolean => {
  const {
    world: worldRef,
    state: stateRef,
    pendingRoute: pendingRouteRef,
    pendingFast: pendingFastRef,
    autoTalk: autoTalkRef,
    locked: lockedRef,
    held: heldRef,
    pointerTarget: pointerTargetRef,
  } = refs
  // 会話・地図を開いた間は歩行の進捗と経路もその場で止める。
  // ただし釣りは止めている間も段階と経過で竿のコマが変わるので、位置は据え置きでコマだけ書き直す。
  // その段階のコマが進み切れば止めている間に変わるものは無いので眠る
  // (次の段階へ移る時は重ね表示が、閉じる時は closeOverlay が起こす)
  if (lockedRef.current) return applyPose()
  if (frameState.enteredWorld !== worldRef.current) {
    frameState.enteredWorld = worldRef.current
    // 初回(起動時)は押しっぱなしではないので捨てる必要がない
    frameState.ignoreHeld = heldRef.current !== null
    // ワープ直後の押しっぱなしポインタは前のワールドの座標のままなので、
    // 一度離す(pointerTargetRef が null になる)まで捨てる。ignoreHeld と同じ考え方
    frameState.staleTarget = pointerTargetRef.current !== null
    frameState.plannedTarget = null
  }
  if (frameState.ignoreHeld && heldRef.current === null) frameState.ignoreHeld = false
  if (frameState.staleTarget && pointerTargetRef.current === null) {
    frameState.staleTarget = false
  }
  const held = frameState.ignoreHeld ? null : heldRef.current
  // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
  if (held !== null) autoTalkRef.current = false
  replanTowardPointer(frameState, refs, held)
  const result = step(
    worldRef.current,
    stateRef.current,
    { held, route: pendingRouteRef.current, fast: pendingFastRef.current },
    elapsed
  )
  pendingRouteRef.current = null
  pendingFastRef.current = false
  stateRef.current = result.state
  const before = worldRef.current
  if (result.arrived !== null) arrive(result.arrived)
  // 経路の最後の1歩で扉へぶつかるのは到着と同じフレーム。到着でワールドが変わっていたら古い衝突なので捨てる
  if (result.bumped !== null && worldRef.current === before) bump(result.bumped)
  const settled = paint(elapsed)
  // 押しっぱなしの向き・ポインタは、ワープ直後に捨てている間も生の ref で見る。
  // 離したのを見届けて(捨てる印を下ろして)から眠る
  const s = stateRef.current
  const resting =
    heldRef.current === null &&
    pointerTargetRef.current === null &&
    pendingRouteRef.current === null &&
    s.motion === null &&
    s.route.length === 0 &&
    s.turnRemainingMs === 0
  return !(resting && settled)
}
