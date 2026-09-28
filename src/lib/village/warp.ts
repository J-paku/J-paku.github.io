// ワープ床の判定(到着したマスにワープが敷いてあれば移動先を返す)と、壁の扉へぶつかる最後の1歩まで含めた経路
// (指定したマスまでの routeToCell・目的のワールドへ通じる扉までの routeToWarp)
import type { Cell, Warp, World } from '@content/types/world'
import { isWalkable } from './collision'
import { findPath } from './path'

export const warpAt = (world: World, cell: Cell): Warp | null =>
  world.warps.find(w => w.cell.x === cell.x && w.cell.y === cell.y) ?? null

const NEIGHBORS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

// 指定したマスまでの経路。壁の扉だけは隣のマスからぶつかる最後の1歩を付ける
export const routeToCell = (world: World, from: Cell, to: Cell): Cell[] | null => {
  if (isWalkable(world, to) || warpAt(world, to) === null) return findPath(world, from, to)
  let best: Cell[] | null = null
  for (const d of NEIGHBORS) {
    const side = { x: to.x + d.x, y: to.y + d.y }
    const path = findPath(world, from, side)
    if (path !== null && (best === null || path.length + 1 < best.length)) {
      best = [...path, to]
    }
  }
  return best
}

// 目的のワールドへ通じるワープまでの経路。壁の扉(通行不可)なら隣のマスまで歩いて最後の1歩で扉へぶつかり、
// 床のワープなら直接そこまで歩く。扉が複数あれば最短を選ぶ。通じる扉が無い・辿り着けないなら null
export const routeToWarp = (world: World, from: Cell, worldId: string): Cell[] | null => {
  let best: Cell[] | null = null
  for (const warp of world.warps) {
    if (warp.target.worldId !== worldId) continue
    const route = routeToCell(world, from, warp.cell)
    if (route !== null && (best === null || route.length < best.length)) best = route
  }
  return best
}
