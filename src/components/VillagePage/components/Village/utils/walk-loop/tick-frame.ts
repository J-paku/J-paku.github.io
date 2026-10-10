// 1 フレーム分の入力を消費して歩みを 1 回進め、その結果を到着・衝突・飛び立ちとして外へ知らせる。
// 移動規則そのものは lib の step に任せ、ここは「どの入力を今は捨てるか」「自動の経路を飛ぶか」と「もう眠ってよいか」を決める。
// 捨てる判定(ワープ直後の押しっぱなし)は入力側では決められない — ワールドが替わったことを知るのはこのループだけ
import type { Cell } from '@content/types/world'
import { isMoving } from '@/lib/village/is-moving'
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
  // 押したまま動かして向かうマスが変わり、そこへ経路を置いた時に 1 回だけ呼ぶ
  retarget: (cell: Cell) => void
  // 飛び立った歩みで 1 回だけ呼ぶ。飛ぶ間は通り過ぎるマスで到着しないので、立っていたマスを離れたと
  // 知らせる機会はここしかない(歩きなら次のマスへの到着が知らせる)
  liftOff: () => void
  // 傘を開け閉めしている最中か。その間は新しい移動を始めない
  umbrellaBusy: () => boolean
}

// 1 フレーム分進めて描く。まだ時間で変わるもの・読むべき入力が残っていれば true。
// reduceMotion は動きを控える設定で、その間は自動の経路を飛ばずに速い歩きで辿る
export const tickFrame = (
  frameState: WalkFrameState,
  refs: MoveRefs,
  { applyPose, paint, arrive, bump, retarget, liftOff, umbrellaBusy }: FrameSteps,
  reduceMotion: boolean,
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
    // 押しっぱなしの向きを捨てる印を立てる。何も押していなければ(起動時など)すぐ下の行が下ろす
    frameState.ignoreHeld = true
    // ワープ直後の押しっぱなしポインタは前のワールドの座標のままなので、
    // 一度離す(pointerTargetRef が null になる)まで捨てる。ignoreHeld と同じ考え方
    frameState.staleTarget = true
    frameState.plannedTarget = null
  }
  if (frameState.ignoreHeld && heldRef.current === null) frameState.ignoreHeld = false
  if (frameState.staleTarget && pointerTargetRef.current === null) {
    frameState.staleTarget = false
  }
  // 傘を開け閉めしている間は新しい移動を始めない(扉の前で畳む間・外へ出て開く間)。
  // 押しっぱなしの向き・ポインタ・自動の経路は捨てずに残し、動き終えた後のフレームで読む。
  // 外へ出た直後は新しい場面をまだ描いていないので、描画だけは進める。
  // 動き終えたら残った入力を読むため、この間は眠らない
  if (umbrellaBusy()) {
    paint(elapsed)
    return true
  }
  const held = frameState.ignoreHeld ? null : heldRef.current
  // 飛んでいる間は押した向きもポインタも読まない(lib の step も読まない入力の錠)。
  // 自動で開く予約を取り消さず、指先へ向けた経路も作り直さない。押したままなら着地した後のフレームで読む
  const grounded = stateRef.current.flight === null
  if (grounded) {
    // 利用者の入力で経路が捨てられたら自動で開くのも取り消す
    if (held !== null) autoTalkRef.current = false
    replanTowardPointer(frameState, refs, held, retarget)
  }
  const result = step(
    worldRef.current,
    stateRef.current,
    {
      held,
      route: pendingRouteRef.current,
      fast: pendingFastRef.current,
      // 自動の移動(高速の経路)は飛ぶ。動きを控える設定では飛ばず、速い歩きで辿る
      fly: pendingFastRef.current && !reduceMotion,
    },
    elapsed
  )
  pendingRouteRef.current = null
  pendingFastRef.current = false
  stateRef.current = result.state
  const before = worldRef.current
  if (result.arrived !== null) arrive(result.arrived)
  // 経路の最後の1歩で扉へぶつかるのは到着と同じフレーム。到着でワールドが変わっていたら古い衝突なので捨てる
  if (result.bumped !== null && worldRef.current === before) bump(result.bumped)
  // 地上にいたのに、この歩みの後は飛んでいる。到着の後に見るので、歩き終えたマスへの到着と飛び立ちが
  // 同じ歩みに重なっても、到着の処理が立てた会話地点を飛び立ちの処理が下ろす順になる。
  // 到着でワールドが替わっていれば移動状態は作り直されて飛んでいないので、知らせない
  if (grounded && stateRef.current.flight !== null) liftOff()
  const settled = paint(elapsed)
  // 押しっぱなしの向き・ポインタは、ワープ直後に捨てている間も生の ref で見る。
  // 離したのを見届けて(捨てる印を下ろして)から眠る。飛んでいる間も歩いている間と同じく眠らない
  const s = stateRef.current
  const resting =
    heldRef.current === null &&
    pointerTargetRef.current === null &&
    pendingRouteRef.current === null &&
    !isMoving(s) &&
    s.route.length === 0 &&
    s.turnRemainingMs === 0
  return !(resting && settled)
}
