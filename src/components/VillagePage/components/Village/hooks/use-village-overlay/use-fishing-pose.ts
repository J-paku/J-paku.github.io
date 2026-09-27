// 釣りの段階を runtime.fishingPose へ写し、歩行ループが竿のコマを描けるようにする
import { useEffect } from 'react'
import type { VillageRuntime } from '../use-village-runtime'
import type { FishingPhase } from './use-village-fishing'

export function useFishingPose(fishingPhase: FishingPhase, runtime: VillageRuntime): void {
  // 投げてから結果窓を閉じるまでは竿を持つ。竿のコマはその段階に入ってからの経過で進むので、
  // 始まりの時刻は段階が変わった時だけ書く(同じ段階のまま effect が回り直しても時計を巻き戻さない)。
  // 歩行ループはその段階のコマが進み切ると眠っているので、印を変えたら起こす
  useEffect(() => {
    if (fishingPhase === 'idle') runtime.fishingPose.current = null
    else if (runtime.fishingPose.current?.phase !== fishingPhase)
      runtime.fishingPose.current = { phase: fishingPhase, since: performance.now() }
    runtime.wake.current()
  }, [fishingPhase, runtime])
}
