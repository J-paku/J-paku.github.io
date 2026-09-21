// 村の組み立て。ワールド・案内・移動ループ・重ね表示の各フックを順に繋ぎ、描画に要る値だけを返す。
// フックを呼ぶ順(寸法→入力→復元→rAF→重ね表示)がそのまま effect の走る順になるので、並べ替えない
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import { nextSpot, talkAnchor } from '@/lib/village/spot'
import { useVillageInput, type VillageActions, type VillageButtons } from './use-village-input'
import { cameraOffset, useStageScale, VIEW_COLS, VIEW_ROWS } from './use-stage-scale'
import { useVillageGuide } from './use-village-guide/use-village-guide'
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
  // 話せる相手がいない時の考え事の吹き出し。2.5 秒で消える。位置は hintRef が毎フレーム追従する
  hintText: string | null
  mode: 'walk' | 'talk' | 'map' | 'clock'
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
  // 今の地点の次があるか。A の「次へ」と会話窓の次へボタンが同じ値を読む(地点が無ければ false)
  hasNext: boolean
  // A/B の行き先の正本。画面の A/B ボタンとキーボードの Z/X が同じものを呼ぶ
  pressA: () => void
  pressB: () => void
  // 会話窓(role='status')の一言を差し替える手。時計の設定窓が結果を伝えるのに使う
  announce: (message: string) => void
}

export function useVillage({ worldSet, text, playerSprites }: VillageOptions): UseVillage {
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
  } = useVillageWorld(worldSet)

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
  } = useVillageInput({ actions: actionsRef, buttons: buttonsRef, locked: lockedRef })

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
    sprites: playerSprites,
    reduceMotion,
    arrive,
    bump,
    tapped,
    consumeTap,
    pointerTargetRef,
  })

  const { mode, openTalk, openMap, closeOverlay, goNext, travel, hintText, announce } =
    useVillageOverlay({
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
    })

  // A/B は重ね表示の手(openTalk・goNext・closeOverlay)を使うので、その後に置く
  const hasNext = activeSpot !== null && nextSpot(worldSet, activeSpot) !== null
  const pressA = useCallback(() => {
    // 話せる相手がいない時は openTalk 自身が「考え事」の一言を出す
    if (mode === 'walk') {
      openTalk()
      return
    }
    if (mode === 'map') return
    // 会話窓・時計の設定窓の中のボタン・リンクへ焦点が移っていれば、そこを押す。
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
    if (mode === 'talk' && hasNext) goNext()
  }, [mode, hasNext, openTalk, goNext])

  // 歩いている時以外は重ね表示が開いているので、B はそれを閉じる
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

  const talkAt = activeSpot === null ? null : talkAnchor(world, activeSpot)
  const talkText = activeSpot === null ? null : arriveSpeech(text, activeSpot)
  const talkLabel = activeSpot === null ? undefined : talkLabelOf(text, activeSpot)

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
    hintText,
    mode,
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
    pressA,
    pressB,
    announce,
  }
}
