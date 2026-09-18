// 村の組み立て。ワールド・案内・移動ループ・重ね表示の各フックを順に繋ぎ、描画に要る値だけを返す。
// フックを呼ぶ順(寸法→入力→復元→rAF→重ね表示)がそのまま effect の走る順になるので、並べ替えない
import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import type { Sheet } from '@/lib/pixel/art'
import { facedCell } from '@/lib/village/spot'
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
  sprites: Sheet
}

type UseVillage = {
  rootRef: RefObject<HTMLDivElement | null>
  frameRef: RefObject<HTMLDivElement | null>
  worldLayerRef: RefObject<HTMLDivElement | null>
  controlsRef: RefObject<HTMLDivElement | null>
  playerRef: RefObject<HTMLDivElement | null>
  locatorRef: RefObject<HTMLDivElement | null>
  loadingRef: RefObject<HTMLDivElement | null>
  camRef: RefObject<{ x: number; y: number }>
  world: World
  destination: Cell | null
  playerCell: Cell
  visited: ReadonlySet<string>
  activeSpot: Spot | null
  speech: string
  reduceMotion: boolean
  locatorVisible: boolean
  placeNames: Record<string, string>
  // 話しかける物のマス(ワールド座標)と呼びかけ。吹き出しは world 層に置くのでカメラを引かない
  talkCell: Cell | null
  talkText: string | null
  // 話しかけた物の枠内位置(マス単位・中心)。モーダルはここから開く
  talkAnchor: { x: number; y: number } | null
  talkLabel: string | undefined
  mode: 'walk' | 'talk' | 'map'
  setHeld: VillageInput['setHeld']
  onKeyDown: VillageInput['onKeyDown']
  onKeyUp: VillageInput['onKeyUp']
  onBlur: VillageInput['onBlur']
  onPointerDown: VillageInput['onPointerDown']
  openTalk: () => void
  openMap: () => void
  closeOverlay: () => void
  goNext: () => void
  travel: (spotId: string) => void
}

export function useVillage({ worldSet, text, sprites }: VillageOptions): UseVillage {
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
  // マス寸法は常に表示枠の10×9で決める。ワールドが広くなってもマスの大きさは変わらない
  useStageScale({ root: rootRef, band: controlsRef, cols: VIEW_COLS, rows: VIEW_ROWS })
  const playerRef = useRef<HTMLDivElement>(null)
  const locatorRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)
  const lockedRef = useRef(false)
  const actionsRef = useRef<VillageActions>(NO_ACTIONS)

  const { heldRef, setHeld, tapped, consumeTap, onKeyDown, onKeyUp, onBlur, onPointerDown } =
    useVillageInput({ actions: actionsRef, locked: lockedRef })

  const {
    visitedRef,
    activeSpotRef,
    visited,
    setVisited,
    activeSpot,
    speech,
    setSpeech,
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
    loadingRef,
    worldRef,
    stateRef,
    pendingRouteRef,
    pendingFastRef,
    lockedRef,
    heldRef,
    sprites,
    reduceMotion,
    arrive,
    bump,
    tapped,
    consumeTap,
  })

  const { mode, openTalk, openMap, closeOverlay, goNext, travel } = useVillageOverlay({
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
  })

  const placeNames = useMemo<Record<string, string>>(
    () => Object.fromEntries(world.spots.map(s => [s.id, text.stops[s.id].place])),
    [world, text]
  )

  const talkCell = activeSpot === null ? null : facedCell(activeSpot)
  const talkText = activeSpot === null ? null : arriveSpeech(text, activeSpot.id)
  // 会話中はカメラが止まるので、開いた時点の原点で枠内位置に直してよい(毎描画で計算し memo しない)
  const talkAnchor =
    talkCell === null
      ? null
      : { x: talkCell.x - camRef.current.x + 0.5, y: talkCell.y - camRef.current.y + 0.5 }
  const talkLabel = activeSpot === null ? undefined : (text.stops[activeSpot.id].talk ?? text.talk)

  return {
    rootRef,
    frameRef,
    worldLayerRef,
    controlsRef,
    playerRef,
    locatorRef,
    loadingRef,
    camRef,
    world,
    destination,
    playerCell,
    visited,
    activeSpot,
    speech,
    reduceMotion,
    locatorVisible,
    placeNames,
    talkCell,
    talkText,
    talkAnchor,
    talkLabel,
    mode,
    setHeld,
    onKeyDown,
    onKeyUp,
    onBlur,
    onPointerDown,
    openTalk,
    openMap,
    closeOverlay,
    goNext,
    travel,
  }
}
