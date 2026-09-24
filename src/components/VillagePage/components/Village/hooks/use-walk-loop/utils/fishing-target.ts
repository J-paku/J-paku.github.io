// 主人公が今釣れる向きに立っているか(釣る対象のマス)をフレームごとに調べ、変わった時だけ React へ知らせる。
// 毎フレーム知らせると、同じ値でも受け手の state 更新で再レンダーが走り続けるため
import type { Cell, World } from '@content/types/world'
import { isFishingSpot } from '@/lib/village/fishing'
import type { MoveState } from '@/lib/village/movement'
import { facedCell } from '@/lib/village/spot'
import type { WalkFrameState } from './types'

// 向きだけ変えた時も判定する。対象が変わった時だけ React へ知らせる
export const notifyFishingTarget = (
  frameState: WalkFrameState,
  world: World,
  state: MoveState,
  onFishingTarget: (cell: Cell | null) => void
): void => {
  const fishingTarget =
    state.motion === null && isFishingSpot(world, state) ? facedCell(state) : null
  const previousTarget = frameState.fishingTarget
  if (previousTarget?.x !== fishingTarget?.x || previousTarget?.y !== fishingTarget?.y) {
    frameState.fishingTarget = fishingTarget
    onFishingTarget(fishingTarget)
  }
}
