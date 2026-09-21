// 重ね表示を閉じた後の道中を立てる。次の地点へ自動で歩く段取りと、地図からの高速移動を持つ
import { useCallback } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { MoveState } from '@/lib/village/movement'
import { findPath } from '@/lib/village/path'
import { nextSpot, type SpotRef } from '@/lib/village/spot'
import { routeToWarp } from '@/lib/village/warp'

type VillageTravelOptions = {
  worldSet: WorldSet
  text: VillageText
  worldRef: RefObject<World>
  worldKeyRef: RefObject<string>
  stateRef: RefObject<MoveState>
  destinationRef: RefObject<Cell | null>
  pendingRouteRef: RefObject<Cell[] | null>
  pendingFastRef: RefObject<boolean>
  pendingGoalRef: RefObject<SpotRef | null>
  autoTalkRef: RefObject<boolean>
  setDestination: Dispatch<SetStateAction<Cell | null>>
  activeSpotRef: RefObject<Spot | null>
  setSpeech: Dispatch<SetStateAction<string>>
  arrive: (cell: Cell) => void
  closeOverlay: () => void
  openTalk: () => void
  // 眠っている歩行ループを起こす手。経路を置いたら呼ぶ
  wake: () => void
}

type UseVillageTravel = {
  goNext: () => void
  travel: (spotId: string) => void
}

export function useVillageTravel({
  worldSet,
  text,
  worldRef,
  worldKeyRef,
  stateRef,
  destinationRef,
  pendingRouteRef,
  pendingFastRef,
  pendingGoalRef,
  autoTalkRef,
  setDestination,
  activeSpotRef,
  setSpeech,
  arrive,
  closeOverlay,
  openTalk,
  wake,
}: VillageTravelOptions): UseVillageTravel {
  // 次の地点までは自動で歩く。到着したら会話窓を自動で開く(地図移動では開かない)。
  // 別ワールドの地点なら、そこへ通じる扉まで歩いて出る(目的地は扉を出た所で立てる)
  const goNext = useCallback(() => {
    const spot = activeSpotRef.current
    closeOverlay()
    if (spot === null) return
    const next = nextSpot(worldSet, spot)
    if (next === null) return
    if (next.worldId === worldKeyRef.current) {
      const route = findPath(worldRef.current, stateRef.current.cell, next.spot.cell)
      if (route === null) {
        setSpeech(text.headTo.replace('{place}', text.stops[next.spot.id].place))
        destinationRef.current = next.spot.cell
        setDestination(next.spot.cell)
        return
      }
      // すでにその場に立っているなら到着扱いで会話をそのまま開く
      if (route.length === 0) {
        activeSpotRef.current = next.spot
        openTalk()
        return
      }
      setSpeech(text.headTo.replace('{place}', text.stops[next.spot.id].place))
      pendingRouteRef.current = route
      pendingFastRef.current = true
      autoTalkRef.current = true
      destinationRef.current = next.spot.cell
      setDestination(next.spot.cell)
      wake()
      return
    }
    setSpeech(text.headTo.replace('{place}', text.stops[next.spot.id].place))
    const route = routeToWarp(worldRef.current, stateRef.current.cell, next.worldId)
    if (route === null) return
    pendingRouteRef.current = route
    pendingFastRef.current = true
    autoTalkRef.current = true
    pendingGoalRef.current = next
    wake()
  }, [
    closeOverlay,
    worldSet,
    text,
    activeSpotRef,
    setSpeech,
    worldKeyRef,
    worldRef,
    stateRef,
    destinationRef,
    pendingRouteRef,
    pendingFastRef,
    pendingGoalRef,
    autoTalkRef,
    setDestination,
    openTalk,
    wake,
  ])

  // 地図からの移動は経路を高速で消費する。地図は屋外だけなので探索も今のワールドでよい
  const travel = useCallback(
    (spotId: string) => {
      closeOverlay()
      // 地図からの移動は会話窓を自動で開かない
      autoTalkRef.current = false
      const here = worldRef.current
      const spot = here.spots.find(s => s.id === spotId)
      if (spot === undefined) return
      const route = findPath(here, stateRef.current.cell, spot.cell)
      if (route === null) return
      // すでにその場に立っているなら到着扱い
      if (route.length === 0) {
        arrive(spot.cell)
        return
      }
      pendingRouteRef.current = route
      pendingFastRef.current = true
      destinationRef.current = spot.cell
      setDestination(spot.cell)
      setSpeech(text.headTo.replace('{place}', text.stops[spot.id].place))
      wake()
    },
    [
      closeOverlay,
      text,
      arrive,
      worldRef,
      stateRef,
      pendingRouteRef,
      pendingFastRef,
      autoTalkRef,
      destinationRef,
      setDestination,
      setSpeech,
      wake,
    ]
  )

  return { goNext, travel }
}
