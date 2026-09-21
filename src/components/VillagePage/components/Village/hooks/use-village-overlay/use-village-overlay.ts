// 会話モーダルと地図の開閉を持つ。開いている間は移動入力を止め、閉じる時に完走の演出を出す。
// 頭上の一言は use-village-hint、閉じた後の道中は use-village-travel に分けてある
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Cell, Direction, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { MoveState } from '@/lib/village/movement'
import { allSpots, type SpotRef } from '@/lib/village/spot'
import { writeVisited } from '@/lib/preferences'
import type { VillageActions } from '../use-village-input'
import { useVillageHint } from './use-village-hint'
import { useVillageTravel } from './use-village-travel'

// clock は卓上時計の設定窓(action: 'clock' の地点)。talk と同じく移動を止めるが、訪問数には数えない
type Mode = 'walk' | 'talk' | 'map' | 'clock'

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
  // 会話窓(role='status')の一言を差し替える手。時計の設定窓が結果を伝えるのに使う
  announce: (message: string) => void
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
  const { hintText, showHint, clearHint } = useVillageHint({ world })
  // コース地点(order を持つ地点)の id 一覧。一度だけ作り、visited との突き合わせに使う
  const courseSpotIds = useMemo(() => allSpots(worldSet).map(spot => spot.id), [worldSet])
  // 全ワールド通しの会話地点数(コース分のみ)
  const totalSpots = courseSpotIds.length
  // 「5 か所すべて話した」の演出は一度だけ出す。再訪の度に一覧へ焦点を奪わない
  const celebratedRef = useRef(false)

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
      showHint(text.noTarget)
      return
    }
    clearHint()
    lockedRef.current = true
    heldRef.current = null
    pendingRouteRef.current = null
    // 時計の地点は会話窓ではなく設定窓。コース外なので visited にも入れない
    if (spot.action === 'clock') {
      setMode('clock')
      return
    }
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
    showHint,
  ])

  const closeOverlay = useCallback(() => {
    // 完走の演出は会話窓を閉じた時だけ。時計の設定窓・地図はここを通っても数えない
    const wasTalk = mode === 'talk'
    lockedRef.current = false
    setMode('walk')
    // コース外の地点(経歴碑など)を先に話しても size は増えるが完走にはならないため、
    // visited に含まれるコース地点の数で判定する
    const visitedCourseCount = courseSpotIds.filter(id => visitedRef.current.has(id)).length
    // 5 か所目の会話を閉じた瞬間だけ、一覧への案内に差し替えて焦点を移す
    if (wasTalk && !celebratedRef.current && visitedCourseCount === totalSpots) {
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
  }, [lockedRef, mode, visitedRef, courseSpotIds, totalSpots, setSpeech, text])

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

  const { goNext, travel } = useVillageTravel({
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
  })

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
    announce: setSpeech,
  }
}
