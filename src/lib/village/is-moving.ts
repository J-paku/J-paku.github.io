// 主人公が動いている最中か。次のマスへ歩いている間(motion)と、自動の移動で飛んでいる間(flight)の両方を数える。
// 飛んでいる間は motion が null のままなので、motion だけを見ると止まっていると取り違える
import type { MoveState } from './movement'

export const isMoving = (state: Pick<MoveState, 'motion' | 'flight'>): boolean =>
  state.motion !== null || state.flight !== null
