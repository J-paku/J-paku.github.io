// 会話モーダルと地図の開閉を持つ。開いている間は移動入力を止め、閉じる時に完走の演出を出す。
// 水辺で話しかけた時は釣りの窓へ回す。頭上の一言は use-village-hint、釣りの進み具合は
// use-village-fishing、閉じた後の道中は use-village-travel に分けてある
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { CareerFeature, CareerRole } from '@content/types/content'
import type { Cell, StopText, VillageText, World, WorldSet } from '@content/types/world'
import { isFishingSpot } from '@/lib/village/fishing'
import { allSpots, facedCell } from '@/lib/village/spot'
import { writeVisited } from '@/lib/preferences'
import { pickDefaultSpeech } from '../../utils/pick-default-speech'
import type { VillageRuntime } from '../use-village-runtime'
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
  // runtime.fishingPose には釣っている間だけ段階とその段階に入った時刻(performance.now())を入れる。
  // 錠を外した・竿の印を変えた・経路を置いた後は runtime.wake で眠っている歩行ループを起こす
  runtime: VillageRuntime
  setDestination: Dispatch<SetStateAction<Cell | null>>
  setVisited: Dispatch<SetStateAction<ReadonlySet<string>>>
  setSpeech: Dispatch<SetStateAction<string>>
  arrive: (cell: Cell) => void
}

type UseVillageOverlay = {
  mode: Mode
  openTalk: () => void
  openMap: () => void
  closeOverlay: () => void
  goNext: () => void
  travel: (spotId: string) => void
  travelTo: (cell: Cell) => void
  // 話せる相手がいない所で話しかけた時の一言。無ければ null
  hintText: string | null
  // 会話窓(role='status')の一言を差し替える手。時計の設定窓が結果を伝えるのに使う
  announce: (message: string) => void
  // 釣りの進み具合と、結果窓に出す文言、浮きを置く水のマス、全部を釣り上げたか。
  // 出す物が無ければ stop は null
  fishing: { phase: FishingPhase; stop: StopText | null; at: Cell | null; exhausted: boolean }
}

export function useVillageOverlay({
  worldSet,
  text,
  catches,
  roleLabels,
  coarse,
  world,
  runtime,
  setDestination,
  setVisited,
  setSpeech,
  arrive,
}: VillageOverlayOptions): UseVillageOverlay {
  const [mode, setMode] = useState<Mode>('walk')
  const { hintText, showHint, clearHint } = useVillageHint({ world })
  const {
    phase: fishingPhase,
    stop: fishingStop,
    at: fishingAt,
    exhausted: fishingExhausted,
    start: startFishing,
    reset: resetFishing,
  } = useVillageFishing({ text, catches, roleLabels, world, setSpeech })
  // コース地点(order を持つ地点)の id 一覧。一度だけ作り、visited との突き合わせに使う
  const courseSpotIds = useMemo(() => allSpots(worldSet).map(spot => spot.id), [worldSet])
  // 全ワールド通しの会話地点数(コース分のみ)
  const totalSpots = courseSpotIds.length
  // 「5 か所すべて話した」の演出は一度だけ出す。再訪の度に一覧へ焦点を奪わない
  const celebratedRef = useRef(false)

  // モーダル・地図が開いている間は移動入力を捨てる。
  // 錠が外れたら、開いている間眠っていた歩行ループを起こす(途中だった歩き・カメラの追従を続ける)
  useEffect(() => {
    runtime.locked.current = mode !== 'walk'
    if (mode !== 'walk') runtime.held.current = null
    else runtime.wake.current()
  }, [mode, runtime])

  // 投げてから結果窓を閉じるまでは竿を持つ。竿のコマはその段階に入ってからの経過で進むので、
  // 始まりの時刻は段階が変わった時だけ書く(同じ段階のまま effect が回り直しても時計を巻き戻さない)。
  // 歩行ループはその段階のコマが進み切ると眠っているので、印を変えたら起こす
  useEffect(() => {
    if (fishingPhase === 'idle') runtime.fishingPose.current = null
    else if (runtime.fishingPose.current?.phase !== fishingPhase)
      runtime.fishingPose.current = { phase: fishingPhase, since: performance.now() }
    runtime.wake.current()
  }, [fishingPhase, runtime])

  const openTalk = useCallback(() => {
    if (runtime.locked.current) return
    if (runtime.state.current.motion !== null) return
    const spot = runtime.activeSpot.current
    if (spot === null) {
      // 水辺を向いているなら直接投げる。釣っている間は移動を止める。
      // 釣れる中身が 1 つも無い時は開かない — 開くと結果窓が出ないまま移動だけ止まってしまう
      if (catches.length > 0 && isFishingSpot(runtime.world.current, runtime.state.current)) {
        // 全部を釣り上げた後は何もしない。水辺の考え事の吹き出しがもう釣れないと伝えているので、
        // 窓も「……」も noTarget の一言も出さず、移動も止めない
        if (fishingExhausted) return
        clearHint()
        runtime.locked.current = true
        runtime.held.current = null
        runtime.pendingRoute.current = null
        setMode('fishing')
        // 浮きと巻物は向いている先の水のマスへ置く。歩き出せば釣りは終わるので、ここで決め打ちできる
        startFishing(facedCell(runtime.state.current))
        return
      }
      // 話せる相手がいない所で話しかけた時は、プレイヤーの頭上に一言だけ出す
      showHint(text.noTarget)
      return
    }
    clearHint()
    runtime.locked.current = true
    runtime.held.current = null
    runtime.pendingRoute.current = null
    // 時計の地点は会話窓ではなく設定窓。コース外なので visited にも入れない
    if (spot.action === 'clock') {
      setMode('clock')
      return
    }
    setMode('talk')
    if (runtime.visited.current.has(spot.id)) return
    const marked = new Set(runtime.visited.current)
    marked.add(spot.id)
    runtime.visited.current = marked
    setVisited(marked)
    writeVisited(worldSet.id, [...marked])
  }, [
    runtime,
    worldSet,
    setVisited,
    text,
    clearHint,
    showHint,
    catches,
    startFishing,
    fishingExhausted,
  ])

  const closeOverlay = useCallback(() => {
    // 完走の演出は会話窓を閉じた時だけ。時計の設定窓・地図はここを通っても数えない
    const wasTalk = mode === 'talk'
    // 釣りを閉じた時は途中のタイマーごと捨て、会話窓を既定文へ戻す(「……」を残さない)。
    // 竿の印は effect を待たずにここでも下ろす — 次の 1 フレームだけ竿を持ったまま残るのを防ぐ。
    // ここで空にしておくので、すぐ投げ直しても次の casting は必ず新しい時刻から数える
    if (mode === 'fishing') {
      resetFishing()
      runtime.fishingPose.current = null
      setSpeech(pickDefaultSpeech(runtime.world.current, text, coarse))
    }
    runtime.locked.current = false
    // 開いている間眠っていた歩行ループを起こす。竿を下ろしたコマもここで描き直させる
    runtime.wake.current()
    setMode('walk')
    // コース外の地点(経歴碑など)を先に話しても size は増えるが完走にはならないため、
    // visited に含まれるコース地点の数で判定する
    const visitedCourseCount = courseSpotIds.filter(id => runtime.visited.current.has(id)).length
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
  }, [runtime, mode, courseSpotIds, totalSpots, setSpeech, text, resetFishing, coarse])

  // M は開閉の切り替え。会話中は無視
  const openMap = useCallback(() => {
    if (mode === 'map') {
      closeOverlay()
      return
    }
    if (runtime.locked.current || world.kind !== 'exterior') return
    runtime.locked.current = true
    runtime.held.current = null
    setMode('map')
  }, [runtime, world, mode, closeOverlay])

  const { goNext, travel, travelTo } = useVillageTravel({
    worldSet,
    text,
    runtime,
    setDestination,
    setSpeech,
    arrive,
    closeOverlay,
    openTalk,
  })

  useEffect(() => {
    runtime.actions.current = { onTalk: openTalk, onMap: openMap, onEscape: closeOverlay }
  }, [openTalk, openMap, closeOverlay, runtime])

  return {
    mode,
    openTalk,
    openMap,
    closeOverlay,
    goNext,
    travel,
    travelTo,
    hintText,
    announce: setSpeech,
    fishing: {
      phase: fishingPhase,
      stop: fishingStop,
      at: fishingAt,
      exhausted: fishingExhausted,
    },
  }
}
