// 村のフックが共有する ref の束を 2 つだけ作る。rAF ループ・入力・重ね表示がフレームをまたいで読み書きする
// 可変の値(VillageRuntime)と、歩行ループが直接書く DOM(VillageDom)。
// ref を作るフックと読むフックが別々だと、同じ ref を 20 本以上も手渡しで繋ぐことになるので、ここで一度に作って束ごと渡す。
// useRef を呼ぶだけで effect を持たないので、フックの呼び順(AGENTS.md 2)には関わらない
import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { Cell, Direction, Spot, World } from '@content/types/world'
import { createMoveState, type MoveState } from '@/lib/village/movement'
import type { FishingPose } from '@/lib/village/player-pose'
import type { SpotRef } from '@/lib/village/spot'
import { cameraOffset } from './use-stage-scale'
import { EMPTY_VISITED } from './use-village-guide/use-village-restore'
import type { VillageActions, VillageButtons } from './use-village-input'

const NO_ACTIONS: VillageActions = { onTalk: () => {}, onMap: () => {}, onEscape: () => {} }
const NO_BUTTONS: VillageButtons = { onA: () => {}, onB: () => {} }

export type VillageRuntime = {
  // rAF ループは再レンダーを待たずに今のワールドを見る必要があるので ref でも持つ
  world: RefObject<World>
  // id ではなく worlds の鍵で覚える(保存・復元はこの鍵で引く)
  worldKey: RefObject<string>
  state: RefObject<MoveState>
  destination: RefObject<Cell | null>
  pendingRoute: RefObject<Cell[] | null>
  pendingFast: RefObject<boolean>
  // 別ワールドの地点へ向かう途中。扉を出た所で目的地と案内を立て直すまで持つ
  pendingGoal: RefObject<SpotRef | null>
  // 次へボタンで出発した時だけ true。到着で会話窓を自動で開く。利用者の入力で経路が捨てられたら取り消す
  autoTalk: RefObject<boolean>
  // モーダル・地図が開いている間は true。移動入力とタップを捨てる
  locked: RefObject<boolean>
  // 今押されている向き
  held: RefObject<Direction | null>
  // 会話窓が開いている間(locked)の方向入力。StopModal が本文送り・焦点移動に読む
  scrollHeld: RefObject<Direction | null>
  // 押されている間、ポインタの下にあるマス。離すと null。use-walk-loop が毎フレーム読んで経路を作り直す
  pointerTarget: RefObject<Cell | null>
  // 釣っている間だけ段階とその段階に入った時刻を持つ(釣っていなければ null)。
  // 重ね表示側が書き、歩行ループが毎フレーム読んで段階と経過から竿のコマを選ぶ
  fishingPose: RefObject<FishingPose | null>
  visited: RefObject<ReadonlySet<string>>
  activeSpot: RefObject<Spot | null>
  // 村側の処理。入力フックは村の状態を知らず、この ref 越しに呼ぶ
  actions: RefObject<VillageActions>
  // キーボードの Z/X が呼ぶ A/B。actions は重ね表示が丸ごと差し替えるので別の ref で持つ
  buttons: RefObject<VillageButtons>
  // 眠っている歩行ループを起こす手の置き場。ループの本体は useWalkLoop が持ち、ここへ今の手を入れる。
  // ワールド・入力・重ね表示はループより先(または外)で呼ぶので、この ref 越しに起こす
  wake: RefObject<() => void>
}

export type VillageDom = {
  frame: RefObject<HTMLDivElement | null>
  // カメラで動く層。この中にだけ地面・人物・目印を入れ、会話窓とミニマップは枠に残す
  worldLayer: RefObject<HTMLDivElement | null>
  player: RefObject<HTMLDivElement | null>
  locator: RefObject<HTMLDivElement | null>
  // 考え事の吹き出しの土台。use-walk-loop が人物と同じ transform を毎フレーム書く
  hint: RefObject<HTMLDivElement | null>
  // 主人公が持つ灯り。吹き出しの土台と同じく、use-walk-loop が人物と同じ transform を毎フレーム書く
  playerLight: RefObject<HTMLDivElement | null>
  // 主人公に重なった街灯を主人公の上へ重ねる層。use-walk-loop が重なりの変わった時だけ書き換える
  lampVeil: RefObject<HTMLDivElement | null>
  // ワープ後に新しいワールドの描画を待つ間だけ出す覆い。閾値を超えた時だけ見せる
  loading: RefObject<HTMLDivElement | null>
  // 今のカメラ原点(マス単位)。タップ位置をワールド座標へ直すのに使う
  cam: RefObject<{ x: number; y: number }>
}

// 束そのものは描画をまたいで同じ実体にする。中の ref は変わらないので、束を依存に入れても作り直しは起きない
export function useVillageRuntime(startWorld: World, startWorldId: string): VillageRuntime {
  const world = useRef<World>(startWorld)
  const worldKey = useRef<string>(startWorldId)
  const state = useRef<MoveState>(createMoveState(startWorld))
  const destination = useRef<Cell | null>(null)
  const pendingRoute = useRef<Cell[] | null>(null)
  const pendingFast = useRef(false)
  const pendingGoal = useRef<SpotRef | null>(null)
  const autoTalk = useRef(false)
  const locked = useRef(false)
  const held = useRef<Direction | null>(null)
  const scrollHeld = useRef<Direction | null>(null)
  const pointerTarget = useRef<Cell | null>(null)
  const fishingPose = useRef<FishingPose | null>(null)
  const visited = useRef<ReadonlySet<string>>(EMPTY_VISITED)
  const activeSpot = useRef<Spot | null>(null)
  const actions = useRef<VillageActions>(NO_ACTIONS)
  const buttons = useRef<VillageButtons>(NO_BUTTONS)
  const wake = useRef<() => void>(() => {})
  return useMemo(
    () => ({
      world,
      worldKey,
      state,
      destination,
      pendingRoute,
      pendingFast,
      pendingGoal,
      autoTalk,
      locked,
      held,
      scrollHeld,
      pointerTarget,
      fishingPose,
      visited,
      activeSpot,
      actions,
      buttons,
      wake,
    }),
    []
  )
}

export function useVillageDom(startWorld: World): VillageDom {
  const frame = useRef<HTMLDivElement>(null)
  const worldLayer = useRef<HTMLDivElement>(null)
  const player = useRef<HTMLDivElement>(null)
  const locator = useRef<HTMLDivElement>(null)
  const hint = useRef<HTMLDivElement>(null)
  const playerLight = useRef<HTMLDivElement>(null)
  const lampVeil = useRef<HTMLDivElement>(null)
  const loading = useRef<HTMLDivElement>(null)
  const cam = useRef(cameraOffset(startWorld, startWorld.start))
  return useMemo(
    () => ({ frame, worldLayer, player, locator, hint, playerLight, lampVeil, loading, cam }),
    []
  )
}
