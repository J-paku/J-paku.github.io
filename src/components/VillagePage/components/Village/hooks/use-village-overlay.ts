// 会話モーダルと地図の開閉を持つ。開いている間は移動入力を止め、閉じる時に次の目的地や高速移動を立てる
import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Cell, Direction, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { MoveState } from '@/lib/village/movement'
import { findPath } from '@/lib/village/path'
import { nextSpot, type SpotRef } from '@/lib/village/spot'
import { routeToWarp } from '@/lib/village/warp'
import { writeVisited } from '@/lib/preferences'
import type { VillageActions } from './use-village-input'

type Mode = 'walk' | 'talk' | 'map'

export type VillageOverlayOptions = {
  worldSet: WorldSet
  text: VillageText
  world: World
  worldRef: RefObject<World>
  worldKeyRef: RefObject<string>
  stateRef: RefObject<MoveState>
  destinationRef: RefObject<Cell | null>
  pendingRouteRef: RefObject<Cell[] | null>
  pendingFastRef: RefObject<boolean>
  pendingGoalRef: RefObject<SpotRef | null>
  setDestination: Dispatch<SetStateAction<Cell | null>>
  visitedRef: RefObject<ReadonlySet<string>>
  setVisited: Dispatch<SetStateAction<ReadonlySet<string>>>
  activeSpotRef: RefObject<Spot | null>
  setSpeech: Dispatch<SetStateAction<string>>
  arrive: (cell: Cell) => void
  lockedRef: RefObject<boolean>
  actionsRef: RefObject<VillageActions>
  heldRef: RefObject<Direction | null>
}

type UseVillageOverlay = {
  mode: Mode
  openTalk: () => void
  openMap: () => void
  closeOverlay: () => void
  goNext: () => void
  travel: (spotId: string) => void
}

export function useVillageOverlay({
  worldSet,
  text,
  world,
  worldRef,
  worldKeyRef,
  stateRef,
  destinationRef,
  pendingRouteRef,
  pendingFastRef,
  pendingGoalRef,
  setDestination,
  visitedRef,
  setVisited,
  activeSpotRef,
  setSpeech,
  arrive,
  lockedRef,
  actionsRef,
  heldRef,
}: VillageOverlayOptions): UseVillageOverlay {
  const [mode, setMode] = useState<Mode>('walk')

  // モーダル・地図が開いている間は移動入力を捨てる
  useEffect(() => {
    lockedRef.current = mode !== 'walk'
    if (mode !== 'walk') heldRef.current = null
  }, [mode, heldRef, lockedRef])

  const openTalk = useCallback(() => {
    const spot = activeSpotRef.current
    if (spot === null || lockedRef.current) return
    lockedRef.current = true
    heldRef.current = null
    pendingRouteRef.current = null
    setMode('talk')
    if (visitedRef.current.has(spot.id)) return
    const marked = new Set(visitedRef.current)
    marked.add(spot.id)
    visitedRef.current = marked
    setVisited(marked)
    writeVisited(worldSet.id, [...marked])
  }, [heldRef, worldSet, activeSpotRef, lockedRef, pendingRouteRef, visitedRef, setVisited])

  // 地図を持つのは屋外だけ。屋内では M キー・ミニマップともに効かない
  const openMap = useCallback(() => {
    if (lockedRef.current || world.kind !== 'exterior') return
    lockedRef.current = true
    heldRef.current = null
    setMode('map')
  }, [heldRef, world, lockedRef])

  const closeOverlay = useCallback(() => {
    lockedRef.current = false
    setMode('walk')
  }, [lockedRef])

  // 次の地点は目的地を立てるだけ。歩くのは利用者。
  // 別ワールドの地点なら、そこへ通じる扉まで歩いて出る(目的地は扉を出た所で立てる)
  const goNext = useCallback(() => {
    const spot = activeSpotRef.current
    closeOverlay()
    if (spot === null) return
    const next = nextSpot(worldSet, spot)
    if (next === null) return
    setSpeech(text.headTo.replace('{place}', text.stops[next.spot.id].place))
    if (next.worldId === worldKeyRef.current) {
      destinationRef.current = next.spot.cell
      setDestination(next.spot.cell)
      return
    }
    const route = routeToWarp(worldRef.current, stateRef.current.cell, next.worldId)
    if (route === null) return
    pendingRouteRef.current = route
    pendingFastRef.current = false
    pendingGoalRef.current = next
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
    setDestination,
  ])

  // 地図からの移動は経路を高速で消費する。地図は屋外だけなので探索も今のワールドでよい
  const travel = useCallback(
    (spotId: string) => {
      closeOverlay()
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
    },
    [
      closeOverlay,
      text,
      arrive,
      worldRef,
      stateRef,
      pendingRouteRef,
      pendingFastRef,
      destinationRef,
      setDestination,
      setSpeech,
    ]
  )

  useEffect(() => {
    actionsRef.current = { onTalk: openTalk, onMap: openMap, onEscape: closeOverlay }
  }, [openTalk, openMap, closeOverlay, actionsRef])

  return { mode, openTalk, openMap, closeOverlay, goNext, travel }
}
