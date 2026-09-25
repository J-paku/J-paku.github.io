// 重ね表示を閉じた後の道中を立てる。次の地点へ自動で歩く段取りと、地図からの高速移動を持つ
import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Cell, VillageText, WorldSet } from '@content/types/world'
import { findPath, nearestReachable } from '@/lib/village/path'
import { nextSpot, spotWorldId, type SpotRef } from '@/lib/village/spot'
import { routeToWarp } from '@/lib/village/warp'
import { headToSpeech } from '../../utils/spot-text'
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
  // 別ワールドの地点へは、そこへ通じる扉まで高速で歩いて出る。目的地の印と案内は扉を出た所で
  // 到着の処理が立て直すので、ここでは前の行き先の印を下ろしておく(残すと別の地点に印が残る)。
  // autoTalk は次へなら true(着いたら会話窓を開く)、地図からの移動なら false
  const headToOtherWorld = useCallback(
    (goal: SpotRef, autoTalk: boolean) => {
      const route = routeToWarp(runtime.world.current, runtime.state.current.cell, goal.worldId)
      if (route === null) return
      runtime.destination.current = null
      setDestination(null)
      setSpeech(headToSpeech(text, goal.spot))
      runtime.pendingRoute.current = route
      runtime.pendingFast.current = true
      runtime.autoTalk.current = autoTalk
      runtime.pendingGoal.current = goal
      runtime.wake.current()
    },
    [runtime, setDestination, setSpeech, text]
  )

  // 次の地点までは自動で歩く。到着したら会話窓を自動で開く(地図移動では開かない)。
  // 別ワールドの地点なら、そこへ通じる扉まで歩いて出る(目的地は扉を出た所で立てる)
  const goNext = useCallback(() => {
    const spot = runtime.activeSpot.current
    closeOverlay()
    if (spot === null) return
    const next = nextSpot(worldSet, spot)
    if (next === null) return
    if (next.worldId === runtime.worldKey.current) {
      // 別ワールドへ向かう途中の行き先が残っていれば捨てる(扉を出た所で古い案内に戻さない)
      runtime.pendingGoal.current = null
      const route = findPath(runtime.world.current, runtime.state.current.cell, next.spot.cell)
      if (route === null) {
        setSpeech(headToSpeech(text, next.spot))
        runtime.destination.current = next.spot.cell
        setDestination(next.spot.cell)
        return
      }
      // すでにその場に立っているなら到着扱いで会話をそのまま開く
      if (route.length === 0) {
        runtime.activeSpot.current = next.spot
        openTalk()
        return
      }
      setSpeech(headToSpeech(text, next.spot))
      runtime.pendingRoute.current = route
      runtime.pendingFast.current = true
      runtime.autoTalk.current = true
      runtime.destination.current = next.spot.cell
      setDestination(next.spot.cell)
      runtime.wake.current()
      return
    }
    headToOtherWorld(next, true)
  }, [closeOverlay, worldSet, text, setSpeech, runtime, setDestination, openTalk, headToOtherWorld])

  // 地図からの移動は経路を高速で消費する。地図の一覧は別のワールド(自室)の地点も載せるので、
  // そちらなら goNext と同じく扉まで歩いて出る(目的地は扉を出た所で到着の処理が立て直す)
  const travel = useCallback(
    (spotId: string) => {
      closeOverlay()
      // 地図からの移動は会話窓を自動で開かない
      runtime.autoTalk.current = false
      const worldId = spotWorldId(worldSet, spotId)
      if (worldId === null) return
      const spot = worldSet.worlds[worldId].spots.find(s => s.id === spotId)
      if (spot === undefined) return
      if (worldId !== runtime.worldKey.current) {
        headToOtherWorld({ worldId, spot }, false)
        return
      }
      const here = runtime.world.current
      const route = findPath(here, runtime.state.current.cell, spot.cell)
      if (route === null) return
      // 別ワールドへ向かう途中の行き先が残っていれば捨てる(着いた時に古い案内へ戻さない)
      runtime.pendingGoal.current = null
      // すでにその場に立っているなら到着扱い
      if (route.length === 0) {
        arrive(spot.cell)
        return
      }
      runtime.pendingRoute.current = route
      runtime.pendingFast.current = true
      runtime.destination.current = spot.cell
      setDestination(spot.cell)
      setSpeech(headToSpeech(text, spot))
      runtime.wake.current()
    },
    [closeOverlay, worldSet, text, arrive, runtime, setDestination, setSpeech, headToOtherWorld]
  )

  // 地図の任意のマスを押した時の移動。押したマスが家・水・木でも、歩いて届くうち最も近いマスまで行く。
  // 行き先が地点の立ち位置と重なった時だけ行き先の案内を出す — 地点でない所へ地点名を言えないため
  const travelTo = useCallback(
    (cell: Cell) => {
      closeOverlay()
      // 地図からの移動は会話窓を自動で開かない
      runtime.autoTalk.current = false
      const here = runtime.world.current
      const goal = nearestReachable(here, runtime.state.current.cell, cell)
      if (goal === null) return
      const route = findPath(here, runtime.state.current.cell, goal)
      if (route === null) return
      // 別ワールドへ向かう途中の行き先が残っていれば捨てる(着いた時に古い案内へ戻さない)
      runtime.pendingGoal.current = null
      // すでにその場に立っているなら到着扱い
      if (route.length === 0) {
        arrive(goal)
        return
      }
      runtime.pendingRoute.current = route
      runtime.pendingFast.current = true
      runtime.destination.current = goal
      setDestination(goal)
      const spot = here.spots.find(s => s.cell.x === goal.x && s.cell.y === goal.y)
      if (spot !== undefined) setSpeech(headToSpeech(text, spot))
      runtime.wake.current()
    },
    [closeOverlay, text, arrive, runtime, setDestination, setSpeech]
  )

  return { goNext, travel, travelTo }
}
