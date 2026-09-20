// 会話地点の判定。家具の上下左右に隣接する通路なら、プレイヤーの向きを問わず話せる。
// コース順(order)は全ワールド通しの通番なので、次の地点はワールドをまたいで探す
import type { Cell, Direction, Rect, Spot, World, WorldSet } from '@content/types/world'

import { isWalkable, structureRect } from './collision'

export type SpotRef = { worldId: string; spot: Spot }

const FACING: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

// 地点で向いている先のマス(話しかける相手の物が置いてある所)
export const facedCell = (spot: Spot): Cell => ({
  x: spot.cell.x + FACING[spot.facing].x,
  y: spot.cell.y + FACING[spot.facing].y,
})

// 吹き出しやモーダルを付ける相手の範囲。家は入口の列、家具は占有矩形。物が見つからなければ向いている 1 マス
export const talkTarget = (world: World, spot: Spot): Rect => {
  const structure = world.structures.find(s => s.id === spot.structureId)
  if (structure === undefined) return { ...facedCell(spot), w: 1, h: 1 }
  if (structure.kind === 'house') {
    const y = structure.solid.y + structure.solid.h - 1
    return { x: structure.doorX, y, w: structure.doorWidth ?? 1, h: 1 }
  }
  return structureRect(structure)
}

export const spotAt = (world: World, cell: Cell): Spot | null => {
  if (!isWalkable(world, cell)) return null
  // 既存の案内先が重なる場合は、明示された立ち位置を優先する
  const exact = world.spots.find(s => s.cell.x === cell.x && s.cell.y === cell.y)
  if (exact !== undefined) return exact
  return (
    world.spots.find(spot => {
      const structure = world.structures.find(s => s.id === spot.structureId)
      if (structure === undefined) return false
      if (structure.kind === 'house') {
        // 家は壁越しではなく、開口幅と一致する正面の通路から案内する
        return (
          cell.y === structure.solid.y + structure.solid.h &&
          cell.x >= structure.doorX &&
          cell.x < structure.doorX + (structure.doorWidth ?? 1)
        )
      }
      const r = structureRect(structure)
      const beside =
        (cell.x === r.x - 1 || cell.x === r.x + r.w) && cell.y >= r.y && cell.y < r.y + r.h
      const aboveOrBelow =
        (cell.y === r.y - 1 || cell.y === r.y + r.h) && cell.x >= r.x && cell.x < r.x + r.w
      return beside || aboveOrBelow
    }) ?? null
  )
}

// 全ワールドの地点を order 昇順で。order の無い地点(コース外)は含まない
const refsInOrder = (set: WorldSet): SpotRef[] =>
  Object.entries(set.worlds)
    .flatMap(([worldId, world]) => world.spots.map(spot => ({ worldId, spot })))
    .filter(ref => ref.spot.order !== undefined)
    .sort((a, b) => (a.spot.order ?? 0) - (b.spot.order ?? 0))

// コース地点のみ(order の無い地点は数えない)
export const allSpots = (set: WorldSet): Spot[] => refsInOrder(set).map(ref => ref.spot)

// コース順の次の地点。current がコース外(order 無し)か最後の地点なら null
export const nextSpot = (set: WorldSet, current: Spot): SpotRef | null => {
  const { order } = current
  if (order === undefined) return null
  return refsInOrder(set).find(ref => ref.spot.order === order + 1) ?? null
}

// order の有無に関わらず、全ワールドの地点から探す(地図の直接移動が order 無しの地点も対象にするため)
export const spotWorldId = (set: WorldSet, spotId: string): string | null => {
  const ref = Object.entries(set.worlds)
    .flatMap(([worldId, world]) => world.spots.map(spot => ({ worldId, spot })))
    .find(r => r.spot.id === spotId)
  return ref?.worldId ?? null
}
