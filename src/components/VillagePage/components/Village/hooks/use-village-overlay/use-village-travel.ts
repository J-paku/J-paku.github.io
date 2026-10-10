// 重ね表示を閉じた後の道中を立てる。次の地点へ自動で歩く段取りと、地図からの高速移動を持つ。
// 何をするかは utils/plan-travel が決め、ここはその結果を runtime と state へ当てて歩行ループを起こすだけ
import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Cell, VillageText, WorldSet } from '@content/types/world'
import {
  planNext,
  planTravel,
  planTravelTo,
  type TravelInput,
  type TravelPlan,
} from '../../utils/plan-travel'
import type { VillageRuntime } from '../use-village-runtime'

type VillageTravelOptions = {
  worldSet: WorldSet
  text: VillageText
  // 経路を置いたら runtime.wake で眠っている歩行ループを起こす
  runtime: VillageRuntime
  setDestination: Dispatch<SetStateAction<Cell | null>>
  setSpeech: Dispatch<SetStateAction<string>>
  arrive: (cell: Cell) => void
  closeOverlay: () => void
  openTalk: () => void
}

type UseVillageTravel = {
  goNext: () => void
  travel: (spotId: string) => void
  travelTo: (cell: Cell) => void
}

// 道中を決める材料として、今のワールドと主人公のマスを runtime から読む。重ね表示を閉じた後に読む
const readInput = (
  worldSet: WorldSet,
  text: VillageText,
  runtime: VillageRuntime
): TravelInput => ({
  worldSet,
  text,
  world: runtime.world.current,
  worldKey: runtime.worldKey.current,
  cell: runtime.state.current.cell,
})

export function useVillageTravel({
  worldSet,
  text,
  runtime,
  setDestination,
  setSpeech,
  arrive,
  closeOverlay,
  openTalk,
}: VillageTravelOptions): UseVillageTravel {
  // 決めた道中を当てる。経路を置いた時は高速で歩かせ、眠っている歩行ループを起こす
  const apply = useCallback(
    (plan: TravelPlan) => {
      if (plan.kind === 'none') return
      if (plan.kind === 'talk') {
        runtime.pendingGoal.current = null
        runtime.activeSpot.current = plan.spot
        openTalk()
        return
      }
      if (plan.kind === 'arrive') {
        runtime.pendingGoal.current = null
        arrive(plan.cell)
        return
      }
      if (plan.kind === 'mark') {
        runtime.pendingGoal.current = null
        setSpeech(plan.speech)
        runtime.destination.current = plan.destination
        setDestination(plan.destination)
        return
      }
      if (plan.kind === 'walk') setSpeech(plan.speech)
      runtime.pendingGoal.current = plan.pendingGoal
      runtime.pendingRoute.current = plan.route
      runtime.pendingFast.current = true
      runtime.autoTalk.current = plan.autoTalk
      runtime.destination.current = plan.destination
      setDestination(plan.destination)
      runtime.wake.current()
    },
    [runtime, openTalk, arrive, setSpeech, setDestination]
  )

  // 会話中の地点は重ね表示を閉じる前に読み、居場所は閉じた後に読む
  const goNext = useCallback(() => {
    const spot = runtime.activeSpot.current
    closeOverlay()
    apply(planNext(readInput(worldSet, text, runtime), spot))
  }, [runtime, closeOverlay, apply, worldSet, text])

  const travel = useCallback(
    (spotId: string) => {
      closeOverlay()
      // 地図からの移動は会話窓を自動で開かない(どこへも向かわない時も取り消す)
      runtime.autoTalk.current = false
      apply(planTravel(readInput(worldSet, text, runtime), spotId))
    },
    [closeOverlay, runtime, apply, worldSet, text]
  )

  const travelTo = useCallback(
    (cell: Cell) => {
      closeOverlay()
      // 地図からの移動は会話窓を自動で開かない(どこへも向かわない時も取り消す)
      runtime.autoTalk.current = false
      apply(planTravelTo(readInput(worldSet, text, runtime), cell))
    },
    [closeOverlay, runtime, apply, worldSet, text]
  )

  return { goNext, travel, travelTo }
}
