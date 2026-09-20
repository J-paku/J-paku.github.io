// 通行判定。tiles の種類と構造物の占有マスを見る。
// 家は area(屋根行+壁行)全体が不可 — 屋根の上に立てると建物の背後へ回り込めてしまう。
// solid は見た目(どこから壁を描くか)の境界で、通行判定には使わない。屋内の家具は置いたマスがそのまま不可
import type { Cell, Rect, Tile, World, Structure } from '@content/types/world'

const WALKABLE_TILES: readonly Tile[] = [
  'grass',
  'grass-alt',
  'path',
  'plaza',
  'flower',
  'floor',
  'mat',
]

const inRect = (r: Rect, c: Cell): boolean =>
  c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h

// 構造物が占有する矩形。家は area 全体、机は 3×2、ベッドは縦 2、テーブル・経歴碑は 2×2、
// 縦の経歴碑(stele)は縦 2、その他は 1×1
export const structureRect = (structure: Structure): Rect => {
  if (structure.kind === 'house') return structure.area
  const { x, y } = structure.cell
  if (structure.kind === 'desk') return { x, y, w: 3, h: 2 }
  if (structure.kind === 'bed') return { x, y, w: 1, h: 2 }
  if (structure.kind === 'table') return { x, y, w: 2, h: 2 }
  if (structure.kind === 'monument') return { x, y, w: 2, h: 2 }
  if (structure.kind === 'stele') return { x, y, w: 1, h: 2 }
  return { x, y, w: 1, h: 1 }
}

const isBlockedByStructure = (world: World, cell: Cell): boolean =>
  world.structures.some(s => inRect(structureRect(s), cell))

export const isWalkable = (world: World, cell: Cell): boolean => {
  if (cell.x < 0 || cell.y < 0 || cell.x >= world.width || cell.y >= world.height) return false
  const tile = world.tiles[cell.y]?.[cell.x]
  if (tile === undefined || !WALKABLE_TILES.includes(tile)) return false
  if (isBlockedByStructure(world, cell)) return false
  return true
}
