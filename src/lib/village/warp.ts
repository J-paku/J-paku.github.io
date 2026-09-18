// ワープ床の判定。到着したマスにワープが敷いてあれば移動先を返す
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

// 目的のワールドへ通じるワープまでの経路。壁の扉(通行不可)なら隣のマスまで歩いて最後の1歩で扉へぶつかり、
// 床のワープなら直接そこまで歩く。扉が複数あれば最短を選ぶ。通じる扉が無い・辿り着けないなら null
export const routeToWarp = (world: World, from: Cell, worldId: string): Cell[] | null => {
  let best: Cell[] | null = null
  for (const warp of world.warps) {
    if (warp.target.worldId !== worldId) continue
    const candidates: (Cell[] | null)[] = isWalkable(world, warp.cell)
      ? [findPath(world, from, warp.cell)]
      : NEIGHBORS.map(d => {
          const side = { x: warp.cell.x + d.x, y: warp.cell.y + d.y }
          const path = findPath(world, from, side)
          return path === null ? null : [...path, warp.cell]
        })
    for (const route of candidates) {
      if (route !== null && (best === null || route.length < best.length)) best = route
    }
  }
  return best
}
