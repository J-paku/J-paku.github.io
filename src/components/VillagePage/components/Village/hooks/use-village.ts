// 村の組み立て。ワールド・案内・移動ループ・重ね表示の各フックを順に繋ぎ、描画に要る値だけを返す。
// フックを呼ぶ順(寸法→入力→復元→rAF→重ね表示)がそのまま effect の走る順になるので、並べ替えない
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { CareerFeature, CareerRole } from '@content/types/content'
import type { Cell, Spot, StopText, VillageText, World, WorldSet } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { waterBubble } from '@/lib/village/fishing'
import type { FishingPose } from '@/lib/village/player-pose'
import { nextSpot, talkAnchor } from '@/lib/village/spot'
import { useVillageInput, type VillageActions, type VillageButtons } from './use-village-input'
import { cameraOffset, useStageScale, VIEW_COLS, VIEW_ROWS } from './use-stage-scale'
import { useVillageGuide } from './use-village-guide/use-village-guide'
import type { FishingPhase } from './use-village-overlay/use-village-fishing'
import { useVillageOverlay } from './use-village-overlay/use-village-overlay'
import { useVillageWorld } from './use-village-world'
import { useWalkLoop } from './use-walk-loop'

const NO_ACTIONS: VillageActions = { onTalk: () => {}, onMap: () => {}, onEscape: () => {} }
const NO_BUTTONS: VillageButtons = { onA: () => {}, onB: () => {} }

// 地点の文言の引き先。時計のような action を持つ地点は会話窓を開かないので stops ではなく専用の欄を見る
const placeName = (text: VillageText, spot: Spot): string =>
  spot.action === 'clock' ? text.clock.place : text.stops[spot.id].place

// 地点に立った時の呼びかけ。地点ごとの文言があればそれ、無ければ arriveAt に場所名を入れる
const arriveSpeech = (text: VillageText, spot: Spot): string =>
  spot.action === 'clock'
    ? text.clock.arrive
    : (text.stops[spot.id].arrive ?? text.arriveAt.replace('{place}', placeName(text, spot)))

// 吹き出しの行動ボタン(A)の文言
const talkLabelOf = (text: VillageText, spot: Spot): string =>
  spot.action === 'clock' ? text.clock.talk : (text.stops[spot.id].talk ?? text.talk)

// 入力フックが返す手はそのまま枠へ渡すだけなので、型もそちらから引く
type VillageInput = ReturnType<typeof useVillageInput>

export type VillageOptions = {
  worldSet: WorldSet
  text: VillageText
  // 池で釣れる中身(今の会社の経歴の機能一覧)と、工程 id → 表示名
  catches: readonly CareerFeature[]
  roleLabels: Record<CareerRole, string>
  // 主人公だけの 16×24 シート(歩行コマの添字に使う)
  playerSprites: SheetLayout
}

type UseVillage = {
  rootRef: RefObject<HTMLDivElement | null>
  frameRef: RefObject<HTMLDivElement | null>
  worldLayerRef: RefObject<HTMLDivElement | null>
  controlsRef: RefObject<HTMLDivElement | null>
  // 一覧への出口を置く箱。縦持ちタッチでは枠の下に高さを持つ
  exitRef: RefObject<HTMLDivElement | null>
  playerRef: RefObject<HTMLDivElement | null>
  locatorRef: RefObject<HTMLDivElement | null>
  // 考え事の吹き出しの土台。use-walk-loop が人物と同じ transform を毎フレーム書く
  hintRef: RefObject<HTMLDivElement | null>
  // 主人公が持つ灯り。吹き出しの土台と同じく、use-walk-loop が人物と同じ transform を毎フレーム書く
  playerLightRef: RefObject<HTMLDivElement | null>
  loadingRef: RefObject<HTMLDivElement | null>
  camRef: RefObject<{ x: number; y: number }>
  world: World
  destination: Cell | null
  playerCell: Cell
  visited: ReadonlySet<string>
  activeSpot: Spot | null
  speech: string
  // 枠の aria-label に出す操作案内。タッチ端末ではスティック・A の説明
  hintLabel: string
  reduceMotion: boolean
  locatorVisible: boolean
  placeNames: Record<string, string>
  // 話しかける物の位置(ワールド座標・マス単位)。x は物の中央、y は上に出すなら物の上辺、下に出すなら下辺。
  // 吹き出しは world 層に置くのでカメラを引かない
  talkAt: { x: number; y: number } | null
  talkText: string | null
  talkLabel: string | undefined
  // 吹き出しの形。地点の会話はいつも台詞で、水辺だけ全部を釣り上げた後はボタンの無い考え事に替わる
  talkKind: 'speech' | 'thought'
  // 話せる相手がいない時の考え事の吹き出し。2.5 秒で消える。位置は hintRef が毎フレーム追従する
  hintText: string | null
  mode: 'walk' | 'talk' | 'map' | 'clock' | 'fishing'
  // 釣りの進み具合と、結果窓に出す文言、浮きを置く水のマス、全部を釣り上げたか。
  // 出す物が無ければ stop は null。exhausted の間は水辺の吹き出しが考え事になり、A を押しても投げない
  fishing: { phase: FishingPhase; stop: StopText | null; at: Cell | null; exhausted: boolean }
  setHeld: VillageInput['setHeld']
  // 会話窓が開いている間の上下入力。StopModal が本文スクロールに読む
  scrollHeldRef: VillageInput['scrollHeldRef']
  onKeyDown: VillageInput['onKeyDown']
  onKeyUp: VillageInput['onKeyUp']
  onBlur: VillageInput['onBlur']
  onPointerDown: VillageInput['onPointerDown']
  onPointerMove: VillageInput['onPointerMove']
  onPointerUp: VillageInput['onPointerUp']
  openTalk: () => void
  openMap: () => void
  closeOverlay: () => void
  goNext: () => void
  travel: (spotId: string) => void
  // 開いている窓に「次へ」があるか。A の「次へ」と窓の次へボタンが同じ値を読む
  hasNext: boolean
  // その「次へ」の行き先
  onNext: () => void
  // A/B の行き先の正本。画面の A/B ボタンとキーボードの Z/X が同じものを呼ぶ
  pressA: () => void
  pressB: () => void
  // 会話窓(role='status')の一言を差し替える手。時計の設定窓が結果を伝えるのに使う
  announce: (message: string) => void
}

export function useVillage({
  worldSet,
  text,
  catches,
  roleLabels,
  playerSprites,
}: VillageOptions): UseVillage {
  // 眠っている歩行ループを起こす手。ループの本体は useWalkLoop が持ち、ここへ今の手を入れる。
  // ワールド・入力・重ね表示はループより先(または外)で呼ぶので、この ref 越しに届ける。
  // ref と手を作るだけで effect は持たないので、フックの呼び順(AGENTS.md 2)には関わらない
  const wakeLoopRef = useRef<() => void>(() => {})
  const wakeLoop = useCallback(() => wakeLoopRef.current(), [])

  const {
    startWorld,
    world,
    worldRef,
    worldKeyRef,
    stateRef,
    destinationRef,
    pendingRouteRef,
    pendingFastRef,
    pendingGoalRef,
    autoTalkRef,
    destination,
    setDestination,
    playerCell,
    setPlayerCell,
    enterWorld,
  } = useVillageWorld(worldSet, wakeLoop)

  const frameRef = useRef<HTMLDivElement>(null)
  // カメラで動く層。この中にだけ地面・人物・目印を入れ、会話窓とミニマップは枠に残す
  const worldLayerRef = useRef<HTMLDivElement>(null)
  // 今のカメラ原点(マス単位)。タップ位置をワールド座標へ直すのに使う
  const camRef = useRef(cameraOffset(startWorld, startWorld.start))
  // 舞台いっぱいの要素と、縦持ちで枠の下に置く十字キー帯。マス寸法はこの2つの実測から決める
  const rootRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const exitRef = useRef<HTMLDivElement>(null)
  // マス寸法は常に表示枠の10×9で決める。ワールドが広くなってもマスの大きさは変わらない
  useStageScale({
    root: rootRef,
    band: controlsRef,
    exit: exitRef,
    cols: VIEW_COLS,
    rows: VIEW_ROWS,
  })
  const playerRef = useRef<HTMLDivElement>(null)
  const locatorRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const playerLightRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)
  const lockedRef = useRef(false)
  const actionsRef = useRef<VillageActions>(NO_ACTIONS)
  const buttonsRef = useRef<VillageButtons>(NO_BUTTONS)
  // 釣っている間だけ段階とその段階に入った時刻を持つ(釣っていなければ null)。
  // 重ね表示側が書き、歩行ループが毎フレーム読んで段階と経過から竿のコマを選ぶ
  const fishingPoseRef = useRef<FishingPose | null>(null)
  const [fishingTarget, setFishingTarget] = useState<Cell | null>(null)

  const {
    heldRef,
    setHeld,
    scrollHeldRef,
    tapped,
    consumeTap,
    onKeyDown,
    onKeyUp,
    onBlur,
    onPointerDown,
    pointerTargetRef,
    onPointerMove,
    onPointerUp,
  } = useVillageInput({
    actions: actionsRef,
    buttons: buttonsRef,
    locked: lockedRef,
    wake: wakeLoop,
  })

  const {
    visitedRef,
    activeSpotRef,
    visited,
    setVisited,
    activeSpot,
    speech,
    setSpeech,
    coarse,
    reduceMotion,
    locatorVisible,
    arrive,
    bump,
  } = useVillageGuide({
    worldSet,
    text,
    startWorld,
    worldRef,
    worldKeyRef,
    stateRef,
    destinationRef,
    pendingGoalRef,
    pendingRouteRef,
    pendingFastRef,
    autoTalkRef,
    actionsRef,
    setDestination,
    setPlayerCell,
    enterWorld,
  })

  useWalkLoop({
    frameRef,
    worldLayerRef,
    camRef,
    playerRef,
    locatorRef,
    hintRef,
    playerLightRef,
    loadingRef,
    worldRef,
    stateRef,
    pendingRouteRef,
    pendingFastRef,
    autoTalkRef,
    lockedRef,
    heldRef,
    fishingPoseRef,
    sprites: playerSprites,
    onFishingTarget: setFishingTarget,
    reduceMotion,
    arrive,
    bump,
    tapped,
    consumeTap,
    pointerTargetRef,
    wakeRef: wakeLoopRef,
  })

  const { mode, openTalk, openMap, closeOverlay, goNext, travel, hintText, announce, fishing } =
    useVillageOverlay({
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
      fishingPoseRef,
      wake: wakeLoop,
    })

  // A/B は重ね表示の手(openTalk・goNext・closeOverlay)を使うので、その後に置く。
  // 画面の A・キーボードの Z・窓の次へボタンが同じ行き先を読む
  const hasNext = mode === 'talk' && activeSpot !== null && nextSpot(worldSet, activeSpot) !== null
  const onNext = goNext
  const pressA = useCallback(() => {
    // 話せる相手がいない時は openTalk 自身が「考え事」の一言を出す
    if (mode === 'walk') {
      openTalk()
      return
    }
    if (mode === 'map') return
    // 会話窓・時計の設定窓・釣りの窓の中のボタン・リンクへ焦点が移っていれば、そこを押す。
    // スティックで本文を送り切った先(次へ・閉じる・本文のリンク)を A で決定できるようにする。
    // 画面の A/B ボタン自身は押下でフォーカスを奪わない(preventFocusSteal)ので、ここには入らない
    const active = document.activeElement
    if (
      (active instanceof HTMLButtonElement || active instanceof HTMLAnchorElement) &&
      active.closest('[role="dialog"]') !== null
    ) {
      active.click()
      return
    }
    if (hasNext) onNext()
  }, [mode, hasNext, onNext, openTalk])

  // 歩いている時以外は重ね表示が開いているので、B はそれを閉じる。
  // 釣りは窓が出ていない間(投げてからかかるまで)も mode が fishing のままなので、B で中断できる
  const pressB = useCallback(() => {
    if (mode !== 'walk') closeOverlay()
  }, [mode, closeOverlay])

  // キーボードの Z/X は ref 越しに呼ぶので、A/B が作り直されたら入れ替える
  useEffect(() => {
    buttonsRef.current = { onA: pressA, onB: pressB }
  }, [pressA, pressB])

  const placeNames = useMemo<Record<string, string>>(
    () => Object.fromEntries(world.spots.map(s => [s.id, placeName(text, s)])),
    [world, text]
  )

  const canFish =
    mode === 'walk' && activeSpot === null && catches.length > 0 && fishingTarget !== null
  const talkAt =
    activeSpot !== null
      ? talkAnchor(world, activeSpot, playerCell)
      : canFish
        ? { x: playerCell.x + 0.5, y: playerCell.y - 0.5 }
        : null
  // 水辺の吹き出しの文言・ボタン・形。全部を釣り上げた後はボタンの無い考え事に替わる
  const water = waterBubble(text.fishing, fishing.exhausted)
  const talkText =
    activeSpot !== null ? arriveSpeech(text, activeSpot) : canFish ? water.text : null
  const talkLabel =
    activeSpot !== null ? talkLabelOf(text, activeSpot) : canFish ? water.label : undefined
  const talkKind = canFish ? water.kind : 'speech'

  return {
    rootRef,
    frameRef,
    worldLayerRef,
    controlsRef,
    exitRef,
    playerRef,
    locatorRef,
    hintRef,
    playerLightRef,
    loadingRef,
    camRef,
    world,
    destination,
    playerCell,
    visited,
    activeSpot,
    speech,
    hintLabel: coarse ? text.hintTouch : text.hint,
    reduceMotion,
    locatorVisible,
    placeNames,
    talkAt,
    talkText,
    talkLabel,
    talkKind,
    hintText: canFish ? null : hintText,
    mode,
    fishing,
    setHeld,
    scrollHeldRef,
    onKeyDown,
    onKeyUp,
    onBlur,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    openTalk,
    openMap,
    closeOverlay,
    goNext,
    travel,
    hasNext,
    onNext,
    pressA,
    pressB,
    announce,
  }
}
