// 釣りの段階を runtime.fishingPose へ写し、歩行ループが竿のコマを描けるようにする
import { useEffect } from 'react'
import type { VillageRuntime } from '../use-village-runtime'
import type { FishingPhase } from './use-village-fishing'

export function useFishingPose(fishingPhase: FishingPhase, runtime: VillageRuntime): void {
  // 投げてから結果窓を閉じるまでは竿を持つ。竿のコマはその段階に入ってからの経過で進むので、
  // 始まりの時刻は段階が変わった時だけ書く。この effect が回るのは段階が変わった時だけ(runtime は描画をまたいで同じ実体)で、
  // ほかに印を書くのは閉じた時に下ろす closeOverlay(null)だけなので、回るたびにその段階の始まりとして書けばよい。
  // 歩行ループはその段階のコマが進み切ると眠っているので、印を変えたら起こす
  useEffect(() => {
    runtime.fishingPose.current =
      fishingPhase === 'idle' ? null : { phase: fishingPhase, since: performance.now() }
    runtime.wake.current()
  }, [fishingPhase, runtime])
}
