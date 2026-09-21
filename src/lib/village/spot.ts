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

// 向いている先のマス(地点なら話しかける相手の物が置いてある所)。
// Spot に限らず歩いている最中の立ち位置と向きでも引けるよう、必要な 2 つだけを受け取る
export const facedCell = (at: { cell: Cell; facing: Direction }): Cell => ({
  x: at.cell.x + FACING[at.facing].x,
  y: at.cell.y + FACING[at.facing].y,
})

// 吹き出しやモーダルを付ける相手の範囲。家は入口の列、家具は占有矩形。物が見つからなければ向いている 1 マス。
// 外から使うのは talkAnchor だけなので、このモジュールの中に閉じる
const talkTarget = (world: World, spot: Spot): Rect => {
  const structure = world.structures.find(s => s.id === spot.structureId)
  if (structure === undefined) return { ...facedCell(spot), w: 1, h: 1 }
  if (structure.kind === 'house') {
    const y = structure.solid.y + structure.solid.h - 1
    return { x: structure.doorX, y, w: structure.doorWidth ?? 1, h: 1 }
  }
  return structureRect(structure)
}

// 吹き出しを付ける位置(マス単位・小数)と、指す点の上下どちらへ置くか。
// 位置は主人公が実際に立つマス(player)で決める。spotAt は物の上下左右どのマスでも地点を拾うので、
// 地点の正規の会話マス(spot.cell)で決めると、別の辺から話しかけた時に吹き出しが主人公から離れて浮く。
// x は物の中央、y は物の上辺。主人公が物より上に立つなら吹き出しが人物を隠すので、主人公の頭上に出す。
// 主人公の頭はマスの上へ半マスはみ出すので、その分だけ上に付ける
export type TalkAnchor = { x: number; y: number; place: 'above' | 'below' }

export const talkAnchor = (world: World, spot: Spot, player: Cell): TalkAnchor => {
  // 建物を持たない出口(arrivalArea だけの地点)は指す物が無く、外周のマスだと上に置き場も無い。
  // 吹き出しの高さは 2 マス弱あるので、上に出すと枠(overflow: hidden)の外で切れる。
  // 範囲の中央・下辺から下へ出し、尾で主人公を指す
  const area = spot.arrivalArea
  if (spot.structureId === undefined && area !== undefined) {
    return { x: area.x + area.w / 2, y: area.y + area.h, place: 'below' }
  }
  const target = talkTarget(world, spot)
  if (player.y < target.y) {
    return { x: player.x + 0.5, y: player.y - 0.5, place: 'above' }
  }
  return { x: target.x + target.w / 2, y: target.y, place: 'above' }
}

export const spotAt = (world: World, cell: Cell): Spot | null => {
  if (!isWalkable(world, cell)) return null
  const arrival = world.spots.find(
    ({ arrivalArea: area }) =>
      area !== undefined &&
      cell.x >= area.x &&
      cell.x < area.x + area.w &&
      cell.y >= area.y &&
      cell.y < area.y + area.h
  )
  if (arrival !== undefined) return arrival
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
