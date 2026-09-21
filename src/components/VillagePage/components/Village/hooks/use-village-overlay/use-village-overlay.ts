// 会話モーダルと地図の開閉を持つ。開いている間は移動入力を止め、閉じる時に完走の演出を出す。
// 水辺で話しかけた時は釣りの窓へ回す。頭上の一言は use-village-hint、釣りの進み具合は
// use-village-fishing、閉じた後の道中は use-village-travel に分けてある
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { CareerFeature, CareerRole } from '@content/types/content'
import type {
  Cell,
  Direction,
  Spot,
  StopText,
  VillageText,
  World,
  WorldSet,
} from '@content/types/world'
import { isFishingSpot } from '@/lib/village/fishing'
import type { MoveState } from '@/lib/village/movement'
import { allSpots, type SpotRef } from '@/lib/village/spot'
import { writeVisited } from '@/lib/preferences'
import type { VillageActions } from '../use-village-input'
import { defaultSpeech } from '../use-village-guide/default-speech'
import { useVillageFishing, type FishingPhase } from './use-village-fishing'
import { useVillageHint } from './use-village-hint'
import { useVillageTravel } from './use-village-travel'

// clock は卓上時計の設定窓(action: 'clock' の地点)。talk と同じく移動を止めるが、訪問数には数えない。
// fishing は水辺で開く釣りの窓。こちらも talk と同じく移動を止める
type Mode = 'walk' | 'talk' | 'map' | 'clock' | 'fishing'

export type VillageOverlayOptions = {
  worldSet: WorldSet
  text: VillageText
  // 釣れる中身(今の会社の経歴の機能一覧)と、工程 id → 表示名
  catches: readonly CareerFeature[]
  roleLabels: Record<CareerRole, string>
  // タッチ端末か。釣りを閉じた後に戻す既定文の選び分けに使う
  coarse: boolean
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
  // 釣りの進み具合と、確認窓・結果窓に出す文言。出す物が無ければ stop は null
  fishing: { phase: FishingPhase; stop: StopText | null; cast: () => void }
}

export function useVillageOverlay({
  worldSet,
  text,
  catches,
  roleLabels,
  coarse,
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
  const {
    phase: fishingPhase,
    stop: fishingStop,
    start: startFishing,
    cast: castFishing,
    reset: resetFishing,
  } = useVillageFishing({ text, catches, roleLabels, world, setSpeech })
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
      // 水辺を向いているなら釣りの確認窓を開く。会話地点と同じく、開いている間は移動を止める
      if (isFishingSpot(worldRef.current, stateRef.current)) {
        clearHint()
        lockedRef.current = true
        heldRef.current = null
        pendingRouteRef.current = null
        setMode('fishing')
        startFishing()
        return
      }
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
    worldRef,
    stateRef,
    startFishing,
  ])

  const closeOverlay = useCallback(() => {
    // 完走の演出は会話窓を閉じた時だけ。時計の設定窓・地図はここを通っても数えない
    const wasTalk = mode === 'talk'
    // 釣りを閉じた時は途中のタイマーごと捨て、会話窓を既定文へ戻す(「……」を残さない)
    if (mode === 'fishing') {
      resetFishing()
      setSpeech(defaultSpeech(worldRef.current, text, coarse))
    }
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
  }, [
    lockedRef,
    mode,
    visitedRef,
    courseSpotIds,
    totalSpots,
    setSpeech,
    text,
    resetFishing,
    worldRef,
    coarse,
  ])

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
    fishing: { phase: fishingPhase, stop: fishingStop, cast: castFishing },
  }
}
