// 会話モーダルと地図の開閉を持つ。開いている間は移動入力を止め、閉じる時に次の目的地や高速移動を立てる
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Cell, Direction, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { MoveState } from '@/lib/village/movement'
import { findPath } from '@/lib/village/path'
import { allSpots, nextSpot, type SpotRef } from '@/lib/village/spot'
import { routeToWarp } from '@/lib/village/warp'
import { writeVisited } from '@/lib/preferences'
import type { VillageActions } from './use-village-input'

type Mode = 'walk' | 'talk' | 'map'

// 一言を消すまでの間
const HINT_DURATION = 2500

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
  autoTalkRef: RefObject<boolean>
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
  // 話せる相手がいない所で話しかけた時の一言。無ければ null
  hintText: string | null
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
  autoTalkRef,
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
  const [hintText, setHintText] = useState<string | null>(null)
  // 一言を消すタイマー。新しい一言が入ったら前の分を捨てる
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 全ワールド通しの会話地点数。visitedRef の大きさと比べて「5 か所すべて話した」を判定する
  const totalSpots = useMemo(() => allSpots(worldSet).length, [worldSet])
  // 「5 か所すべて話した」の演出は一度だけ出す。再訪の度に一覧へ焦点を奪わない
  const celebratedRef = useRef(false)

  // タイマーと一言をまとめて消す
  const clearHint = useCallback(() => {
    if (hintTimerRef.current !== null) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
    setHintText(null)
  }, [])

  // アンマウント時に一言とタイマーを残さない
  useEffect(() => clearHint, [clearHint])

  // ワープ(ワールド変更)では一言を持ち越さない
  useEffect(() => {
    clearHint()
  }, [world, clearHint])

  // モーダル・地図が開いている間は移動入力を捨てる
  useEffect(() => {
    lockedRef.current = mode !== 'walk'
    if (mode !== 'walk') heldRef.current = null
  }, [mode, heldRef, lockedRef])

  const openTalk = useCallback(() => {
    if (lockedRef.current) return
    const spot = activeSpotRef.current
    if (spot === null) {
      // 話せる相手がいない所で話しかけた時は、プレイヤーの頭上に一言だけ出す
      clearHint()
      setHintText(text.noTarget)
      hintTimerRef.current = setTimeout(() => clearHint(), HINT_DURATION)
      return
    }
    clearHint()
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
  }, [
    heldRef,
    worldSet,
    activeSpotRef,
    lockedRef,
    pendingRouteRef,
    visitedRef,
    setVisited,
    text,
    clearHint,
  ])

  const closeOverlay = useCallback(() => {
    const wasTalk = mode === 'talk'
    lockedRef.current = false
    setMode('walk')
    // 5 か所目の会話を閉じた瞬間だけ、一覧への案内に差し替えて焦点を移す
    if (wasTalk && !celebratedRef.current && visitedRef.current.size === totalSpots) {
      celebratedRef.current = true
      setSpeech(text.allSeen.replace('{list}', text.toList))
      // StopModal のアンマウント処理(返却先フォーカス)の後に上書きするため、次フレームまで待つ
      window.requestAnimationFrame(() => {
        const exit = document.querySelector<HTMLElement>('[data-village-exit]')
        if (exit === null) return
        exit.dataset.bounce = ''
        exit.focus()
      })
    }
  }, [lockedRef, mode, visitedRef, totalSpots, setSpeech, text])

  // M は開閉の切り替え。会話中は無視
  const openMap = useCallback(() => {
    if (mode === 'map') {
      closeOverlay()
      return
    }
    if (lockedRef.current || world.kind !== 'exterior') return
    lockedRef.current = true
    heldRef.current = null
    setMode('map')
  }, [heldRef, world, lockedRef, mode, closeOverlay])

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
      return
    }
    setSpeech(text.headTo.replace('{place}', text.stops[next.spot.id].place))
    const route = routeToWarp(worldRef.current, stateRef.current.cell, next.worldId)
    if (route === null) return
    pendingRouteRef.current = route
    pendingFastRef.current = true
    autoTalkRef.current = true
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
    autoTalkRef,
    setDestination,
    openTalk,
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
    ]
  )

  useEffect(() => {
    actionsRef.current = { onTalk: openTalk, onMap: openMap, onEscape: closeOverlay }
  }, [openTalk, openMap, closeOverlay, actionsRef])

  return {
    mode,
    openTalk,
    openMap,
    closeOverlay,
    goNext,
    travel,
    hintText,
  }
}
