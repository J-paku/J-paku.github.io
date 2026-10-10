// 重ね表示を閉じた後の道中で何をするかを決める。次へ(planNext)・地図の一覧から(planTravel)・
// 地図のマスを押して(planTravelTo)の 3 つが、置く経路・目的地の印・案内・会話窓を開く印を結果の形で返す。
// 決めるだけで書かない。runtime の ref と state へ当てて歩行ループを起こすのは hooks/use-village-overlay/use-village-travel
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import { findPath, nearestReachable } from '@/lib/village/path'
import { nextSpot, spotWorldId, type SpotRef } from '@/lib/village/spot'
import { routeToWarp } from '@/lib/village/warp'
import { headToSpeech } from './spot-text'

// 道中を決める材料。runtime の ref から読んだ今の値をそのまま渡す
export type TravelInput = {
  worldSet: WorldSet
  text: VillageText
  // 今いるワールドと、その worlds の鍵(地点のワールドとはこの鍵で比べる)
  world: World
  worldKey: string
  // 主人公の立っているマス
  cell: Cell
}

// 経路を置いて高速で歩く時に runtime へ置くもの
type Walk = {
  route: Cell[]
  // 目的地の印。別ワールドへ向かう時は null で前の印を下ろす(残すと別の地点に印が残る)。
  // 別ワールドの目的地の印と案内は、扉を出た所で到着の処理が立て直す
  destination: Cell | null
  // 着いたら会話窓を自動で開くか。次へなら true、地図からの移動なら false
  autoTalk: boolean
  // 別ワールドの地点へ向かう途中の行き先。同じワールドの中なら null にして、
  // 前に別ワールドへ向かっていた時の行き先を捨てる(着いた時・扉を出た所で古い案内へ戻さない)
  pendingGoal: SpotRef | null
}

// 経路を置いて高速で歩き、行き先の案内を出す
type WalkPlan = Walk & { kind: 'walk'; speech: string }

// 経路を置いて高速で歩くが、案内は出さない(地点でない所へは地点名を言えない)
type SilentWalkPlan = Walk & { kind: 'walkSilently' }

// talk・arrive・mark も、別ワールドへ向かう途中の行き先を捨てる
export type TravelPlan =
  // どこへも向かわない(重ね表示を閉じるだけ)
  | { kind: 'none' }
  // 次の地点にもう立っているので、歩かずに到着扱いでその場の会話窓を開く
  | { kind: 'talk'; spot: Spot }
  // 地図で選んだ行き先にもう立っているので、歩かずに到着として扱う
  | { kind: 'arrive'; cell: Cell }
  // 次の地点へ歩いて届かないので、経路は置かずに案内と目的地の印だけ立てる
  | { kind: 'mark'; destination: Cell; speech: string }
  | WalkPlan
  | SilentWalkPlan

const NONE: TravelPlan = { kind: 'none' }

// 別ワールドの地点へは、そこへ通じる扉まで高速で歩いて出る。行き先は地点ごと持っておき、
// 扉を出た所で到着の処理が目的地の印と案内を立て直す。通じる扉が無い・扉まで歩いて届かないなら何もしない
const planOtherWorld = (input: TravelInput, goal: SpotRef, autoTalk: boolean): TravelPlan => {
  const route = routeToWarp(input.world, input.cell, goal.worldId)
  if (route === null) return NONE
  return {
    kind: 'walk',
    route,
    destination: null,
    speech: headToSpeech(input.text, goal.spot),
    autoTalk,
    pendingGoal: goal,
  }
}

// 次へ。会話中の地点からコース順で次の地点まで自動で歩き、着いたら会話窓を開く。
// 別ワールドの地点なら、そこへ通じる扉まで歩いて出る。会話中の地点が無い・コースの最後なら何もしない
export const planNext = (input: TravelInput, activeSpot: Spot | null): TravelPlan => {
  if (activeSpot === null) return NONE
  const next = nextSpot(input.worldSet, activeSpot)
  if (next === null) return NONE
  if (next.worldId !== input.worldKey) return planOtherWorld(input, next, true)
  const route = findPath(input.world, input.cell, next.spot.cell)
  if (route === null) {
    return {
      kind: 'mark',
      destination: next.spot.cell,
      speech: headToSpeech(input.text, next.spot),
    }
  }
  if (route.length === 0) return { kind: 'talk', spot: next.spot }
  return {
    kind: 'walk',
    route,
    destination: next.spot.cell,
    speech: headToSpeech(input.text, next.spot),
    autoTalk: true,
    pendingGoal: null,
  }
}

// 地図の一覧から地点を選んだ移動。一覧は別のワールド(自室)の地点も載せるので、そちらなら次へと同じく
// 扉まで歩いて出る。着いても会話窓は開かない。一覧に無い id・歩いて届かない地点なら何もしない
// (別ワールドへ向かう途中の行き先もそのまま残る)
export const planTravel = (input: TravelInput, spotId: string): TravelPlan => {
  const worldId = spotWorldId(input.worldSet, spotId)
  if (worldId === null) return NONE
  const spot = input.worldSet.worlds[worldId].spots.find(s => s.id === spotId)
  if (spot === undefined) return NONE
  if (worldId !== input.worldKey) return planOtherWorld(input, { worldId, spot }, false)
  const route = findPath(input.world, input.cell, spot.cell)
  if (route === null) return NONE
  if (route.length === 0) return { kind: 'arrive', cell: spot.cell }
  return {
    kind: 'walk',
    route,
    destination: spot.cell,
    speech: headToSpeech(input.text, spot),
    autoTalk: false,
    pendingGoal: null,
  }
}

// 地図の任意のマスを押した移動。押したマスが家・水・木でも、歩いて届くうち最も近いマスまで行く。
// 行き先が地点の立ち位置と重なった時だけ行き先の案内を出す — 地点でない所へ地点名を言えないため
export const planTravelTo = (input: TravelInput, target: Cell): TravelPlan => {
  const goal = nearestReachable(input.world, input.cell, target)
  if (goal === null) return NONE
  const route = findPath(input.world, input.cell, goal)
  if (route === null) return NONE
  if (route.length === 0) return { kind: 'arrive', cell: goal }
  const walk: Walk = { route, destination: goal, autoTalk: false, pendingGoal: null }
  const spot = input.world.spots.find(s => s.cell.x === goal.x && s.cell.y === goal.y)
  if (spot === undefined) return { kind: 'walkSilently', ...walk }
  return { kind: 'walk', ...walk, speech: headToSpeech(input.text, spot) }
}
