// 村の組み立て。ワールド・案内・移動ループ・重ね表示の各フックを順に繋ぎ、描画に要る値だけを返す。
// フックを呼ぶ順(寸法→入力→復元→rAF→重ね表示)がそのまま effect の走る順になるので、並べ替えない。
// フック同士が共有する ref は use-village-runtime.ts の束 2 つ(runtime・dom)で最初に一度に作り、
// 各フックはそれを受け取るだけにする(ref を 1 本ずつ次のフックへ手渡ししない)
import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { CareerFeature, CareerRole } from '@content/types/content'
import type { Cell, Spot, StopText, VillageText, World, WorldSet } from '@content/types/world'
import type { SheetLayout } from '@/lib/pixel/art'
import type { DoorMarker } from '@/lib/village/door-marker'
import type { MapEntry } from '@/lib/village/map-entries'
import { VIEW_COLS, VIEW_ROWS } from '../utils/stage-scale'
import { resolveTalkBubble } from '../utils/talk-bubble'
import { useMapData } from './use-map-data'
import { useVillageButtons } from './use-village-buttons'
import { useVillageInput } from './use-village-input'
import { useStageScale } from './use-stage-scale'
import { useVillageGuide } from './use-village-guide/use-village-guide'
import type { FishingPhase } from './use-village-overlay/use-village-fishing'
import { useVillageOverlay } from './use-village-overlay/use-village-overlay'
import { useVillageWorld } from './use-village-world'
import { useWalkLoop } from './use-walk-loop/use-walk-loop'
import { useVillageDom, useVillageRuntime, type VillageRuntime } from './use-village-runtime'

// 入力フックが返す手はそのまま枠へ渡すだけなので、型もそちらから引く
type VillageInput = ReturnType<typeof useVillageInput>

export type VillageOptions = {
  worldSet: WorldSet
  text: VillageText
  // 池で釣れる中身(今の会社の経歴の機能一覧)と、工程 id → 表示名
  catches: readonly CareerFeature[]
  roleLabels: Record<CareerRole, string>
  // ワールドのスプライトシート。歩行ループが主人公に重なった街灯を重ねる時に添字を引く
  sprites: SheetLayout
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
  // 主人公に重なった街灯を主人公の上へ重ねる層。use-walk-loop が重なりの変わった時だけ書き換える
  lampVeilRef: RefObject<HTMLDivElement | null>
  loadingRef: RefObject<HTMLDivElement | null>
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
  // 全ワールドの地点 id → 地点名。地図の一覧が別のワールド(自室)の地点名も引く
  placeNames: Record<string, string>
  // 地図に並べる地点(番号・位置・訪問済み)
  entries: MapEntry[]
  doors: DoorMarker[]
  // 話しかける物の位置(ワールド座標・マス単位)。x は物の中央、y は上に出すなら物の上辺、下に出すなら下辺。
  // 吹き出しは world 層に置くのでカメラを引かない
  talkAt: { x: number; y: number } | null
  talkText: string | null
  talkLabel: string | undefined
  // 吹き出しの形。地点の会話はいつも台詞で、水辺だけ全部を釣り上げた後はボタンの無い考え事に替わる
  talkKind: 'speech' | 'thought'
  // 吹き出しの行動ボタン。枠へ焦点を戻してから話しかける
  talkAction: () => void
  // 話せる相手がいない時の考え事の吹き出し。2.5 秒で消える。位置は hintRef が毎フレーム追従する
  hintText: string | null
  mode: 'walk' | 'talk' | 'map' | 'clock' | 'fishing'
  // 釣りの進み具合と、結果窓に出す文言、浮きを置く水のマス、全部を釣り上げたか。
  // 出す物が無ければ stop は null。exhausted の間は水辺の吹き出しが考え事になり、A を押しても投げない
  fishing: { phase: FishingPhase; stop: StopText | null; at: Cell | null; exhausted: boolean }
  setHeld: VillageInput['setHeld']
  // 会話窓が開いている間の上下入力。StopModal が本文スクロールに読む
  scrollHeldRef: VillageRuntime['scrollHeld']
  onKeyDown: VillageInput['onKeyDown']
  onKeyUp: VillageInput['onKeyUp']
  onBlur: VillageInput['onBlur']
  onPointerDown: VillageInput['onPointerDown']
  onPointerMove: VillageInput['onPointerMove']
  onPointerUp: VillageInput['onPointerUp']
  openMap: () => void
  closeOverlay: () => void
  goNext: () => void
  travel: (spotId: string) => void
  // 地図の任意のマスへの移動
  travelTo: (cell: Cell) => void
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
  sprites,
  playerSprites,
}: VillageOptions): UseVillage {
  const startWorld = worldSet.worlds[worldSet.startWorldId]
  // ref と束を作るだけで effect は持たないので、フックの呼び順(AGENTS.md 2)には関わらない
  const runtime = useVillageRuntime(startWorld, worldSet.startWorldId)
  const dom = useVillageDom(startWorld)

  const { world, destination, setDestination, playerCell, setPlayerCell, enterWorld } =
    useVillageWorld(worldSet, runtime)

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
  const [fishingTarget, setFishingTarget] = useState<Cell | null>(null)

  const {
    setHeld,
    tapped,
    consumeTap,
    onKeyDown,
    onKeyUp,
    onBlur,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = useVillageInput({ runtime, cam: dom.cam })

  const {
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
    runtime,
    setDestination,
    setPlayerCell,
    enterWorld,
  })

  useWalkLoop({
    runtime,
    dom,
    sprites: playerSprites,
    veilSprites: sprites,
    reduceMotion,
    arrive,
    bump,
    tapped,
    consumeTap,
    setDestination,
    onFishingTarget: setFishingTarget,
  })

  const {
    mode,
    openTalk,
    openMap,
    closeOverlay,
    goNext,
    travel,
    travelTo,
    hintText,
    announce,
    fishing,
  } = useVillageOverlay({
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
  })

  // A/B は重ね表示の手(openTalk・goNext・closeOverlay)を使うので、その後に呼ぶ
  const { hasNext, onNext, pressA, pressB } = useVillageButtons({
    mode,
    activeSpot,
    worldSet,
    openTalk,
    goNext,
    closeOverlay,
    runtime,
  })

  const { placeNames, entries, doors } = useMapData({ worldSet, text, world, visited })

  const { canFish, talkAt, talkText, talkLabel, talkKind } = resolveTalkBubble({
    mode,
    catchCount: catches.length,
    activeSpot,
    fishingTarget,
    world,
    playerCell,
    text,
    exhausted: fishing.exhausted,
  })
  const talkAction = () => {
    dom.frame.current?.focus()
    openTalk()
  }

  return {
    rootRef,
    frameRef: dom.frame,
    worldLayerRef: dom.worldLayer,
    controlsRef,
    exitRef,
    playerRef: dom.player,
    locatorRef: dom.locator,
    hintRef: dom.hint,
    playerLightRef: dom.playerLight,
    lampVeilRef: dom.lampVeil,
    loadingRef: dom.loading,
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
    entries,
    doors,
    talkAt,
    talkText,
    talkLabel,
    talkKind,
    talkAction,
    hintText: canFish ? null : hintText,
    mode,
    fishing,
    setHeld,
    scrollHeldRef: runtime.scrollHeld,
    onKeyDown,
    onKeyUp,
    onBlur,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    openMap,
    closeOverlay,
    goNext,
    travel,
    travelTo,
    hasNext,
    onNext,
    pressA,
    pressB,
    announce,
  }
}
