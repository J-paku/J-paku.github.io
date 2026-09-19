// 村の組み立て。ワールド・案内・移動ループ・重ね表示の各フックを順に繋ぎ、描画に要る値だけを返す。
// フックを呼ぶ順(寸法→入力→復元→rAF→重ね表示)がそのまま effect の走る順になるので、並べ替えない
import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { Sheet } from '@/lib/pixel/art'
import { talkTarget } from '@/lib/village/spot'
import { useVillageInput, type VillageActions } from './use-village-input'
import { cameraOffset, useStageScale, VIEW_COLS, VIEW_ROWS } from './use-stage-scale'
import { useVillageGuide } from './use-village-guide'
import { useVillageOverlay } from './use-village-overlay'
import { useVillageWorld } from './use-village-world'
import { useWalkLoop } from './use-walk-loop'

const NO_ACTIONS: VillageActions = { onTalk: () => {}, onMap: () => {}, onEscape: () => {} }

// 地点に立った時の呼びかけ。地点ごとの文言があればそれ、無ければ arriveAt に場所名を入れる
const arriveSpeech = (text: VillageText, spotId: string): string =>
  text.stops[spotId].arrive ?? text.arriveAt.replace('{place}', text.stops[spotId].place)

// 入力フックが返す手はそのまま枠へ渡すだけなので、型もそちらから引く
type VillageInput = ReturnType<typeof useVillageInput>

export type VillageOptions = {
  worldSet: WorldSet
  text: VillageText
  // 主人公だけの 16×24 シート(歩行コマの添字に使う)
  playerSprites: Sheet
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
  mode: 'walk' | 'talk' | 'map'
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
  const loadingRef = useRef<HTMLDivElement>(null)
  const lockedRef = useRef(false)
  const actionsRef = useRef<VillageActions>(NO_ACTIONS)

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
  } = useVillageInput({ actions: actionsRef, locked: lockedRef })

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

  const { mode, openTalk, openMap, closeOverlay, goNext, travel, hintText } = useVillageOverlay({
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

  const placeNames = useMemo<Record<string, string>>(
    () => Object.fromEntries(world.spots.map(s => [s.id, text.stops[s.id].place])),
    [world, text]
  )

  const target = activeSpot === null ? null : talkTarget(world, activeSpot)
  // 吹き出しは物の上に出す。物がプレイヤーより下(下を向く地点)なら人物を隠すので、プレイヤーの頭上に出す。
  // 主人公の頭はマスの上へ半マスはみ出すので、その分だけ上に付ける
  const talkAt =
    activeSpot === null || target === null
      ? null
      : activeSpot.facing === 'down'
        ? { x: activeSpot.cell.x + 0.5, y: activeSpot.cell.y - 0.5 }
        : { x: target.x + target.w / 2, y: target.y }
  const talkText = activeSpot === null ? null : arriveSpeech(text, activeSpot.id)
  const talkLabel = activeSpot === null ? undefined : (text.stops[activeSpot.id].talk ?? text.talk)

  return {
    rootRef,
    frameRef,
    worldLayerRef,
    controlsRef,
    exitRef,
    playerRef,
    locatorRef,
    hintRef,
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
  }
}
