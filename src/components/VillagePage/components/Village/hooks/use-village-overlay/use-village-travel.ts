// 重ね表示を閉じた後の道中を立てる。次の地点へ自動で歩く段取りと、地図からの高速移動を持つ
import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Cell, VillageText, WorldSet } from '@content/types/world'
import { findPath, nearestReachable } from '@/lib/village/path'
import { nextSpot } from '@/lib/village/spot'
import { routeToWarp } from '@/lib/village/warp'
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
  // 次の地点までは自動で歩く。到着したら会話窓を自動で開く(地図移動では開かない)。
  // 別ワールドの地点なら、そこへ通じる扉まで歩いて出る(目的地は扉を出た所で立てる)
  const goNext = useCallback(() => {
    const spot = runtime.activeSpot.current
    closeOverlay()
    if (spot === null) return
    const next = nextSpot(worldSet, spot)
    if (next === null) return
    if (next.worldId === runtime.worldKey.current) {
      const route = findPath(runtime.world.current, runtime.state.current.cell, next.spot.cell)
      if (route === null) {
        setSpeech(text.headTo.replace('{place}', text.stops[next.spot.id].place))
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
      setSpeech(text.headTo.replace('{place}', text.stops[next.spot.id].place))
      runtime.pendingRoute.current = route
      runtime.pendingFast.current = true
      runtime.autoTalk.current = true
      runtime.destination.current = next.spot.cell
      setDestination(next.spot.cell)
      runtime.wake.current()
      return
    }
    setSpeech(text.headTo.replace('{place}', text.stops[next.spot.id].place))
    const route = routeToWarp(runtime.world.current, runtime.state.current.cell, next.worldId)
    if (route === null) return
    runtime.pendingRoute.current = route
    runtime.pendingFast.current = true
    runtime.autoTalk.current = true
    runtime.pendingGoal.current = next
    runtime.wake.current()
  }, [closeOverlay, worldSet, text, setSpeech, runtime, setDestination, openTalk])

  // 地図からの移動は経路を高速で消費する。地図は屋外だけなので探索も今のワールドでよい
  const travel = useCallback(
    (spotId: string) => {
      closeOverlay()
      // 地図からの移動は会話窓を自動で開かない
      runtime.autoTalk.current = false
      const here = runtime.world.current
      const spot = here.spots.find(s => s.id === spotId)
      if (spot === undefined) return
      const route = findPath(here, runtime.state.current.cell, spot.cell)
      if (route === null) return
      // すでにその場に立っているなら到着扱い
      if (route.length === 0) {
        arrive(spot.cell)
        return
      }
      runtime.pendingRoute.current = route
      runtime.pendingFast.current = true
      runtime.destination.current = spot.cell
      setDestination(spot.cell)
      setSpeech(text.headTo.replace('{place}', text.stops[spot.id].place))
      runtime.wake.current()
    },
    [closeOverlay, text, arrive, runtime, setDestination, setSpeech]
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
      if (spot !== undefined) setSpeech(text.headTo.replace('{place}', text.stops[spot.id].place))
      runtime.wake.current()
    },
    [closeOverlay, text, arrive, runtime, setDestination, setSpeech]
  )

  return { goNext, travel, travelTo }
}
