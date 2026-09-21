// 構造物を 1 マスずつのスプライトへ展開する。描画側はこの配列をそのまま並べるだけでよい
import type { Cell, Structure } from '@content/types/world'
import type { SpriteKey } from '@/lib/pixel/sprites'

export type FacadeCell = { cell: Cell; key: SpriteKey }

// 幅方向の位置から l / m / r を選ぶ。幅 1 は l、幅 2 は l と r になる
const side = (x: number, left: number, right: number): 'l' | 'm' | 'r' => {
  if (x === left) return 'l'
  if (x === right) return 'r'
  return 'm'
}

const wallKey = (x: number, left: number, right: number): SpriteKey =>
  `wall-${side(x, left, right)}`

// 左上マスからの相対位置ごとにキーを並べた家具・設置物。行優先(上の行から左→右)
const FURNITURE: Record<
  'desk' | 'bed' | 'table' | 'monument' | 'stele' | 'lamp',
  { w: number; keys: readonly SpriteKey[] }
> = {
  desk: { w: 3, keys: ['desk-tl', 'desk-tm', 'desk-tr', 'desk-bl', 'desk-bm', 'desk-br'] },
  bed: { w: 1, keys: ['bed-t', 'bed-b'] },
  table: { w: 2, keys: ['table-tl', 'table-tr', 'table-bl', 'table-br'] },
  monument: { w: 2, keys: ['monument-tl', 'monument-tr', 'monument-bl', 'monument-br'] },
  stele: { w: 1, keys: ['stele-t', 'stele-b'] },
  lamp: { w: 1, keys: ['lamp-t', 'lamp-b'] },
}

export const facadeCells = (structure: Structure): FacadeCell[] => {
  // 1×1 の設置物は kind がそのままスプライトの鍵になる
  if (
    structure.kind === 'robot' ||
    structure.kind === 'mailbox' ||
    structure.kind === 'campfire' ||
    structure.kind === 'clock'
  ) {
    return [{ cell: structure.cell, key: structure.kind }]
  }
  if (structure.kind !== 'house') {
    const { w, keys } = FURNITURE[structure.kind]
    return keys.map((key, i) => ({
      cell: { x: structure.cell.x + (i % w), y: structure.cell.y + Math.floor(i / w) },
      key,
    }))
  }

  const { area, solid, roof, doorX } = structure
  const left = area.x
  const right = area.x + area.w - 1
  const cells: FacadeCell[] = []
  // 屋根行 = area のうち solid より上の行。最上段だけが輪郭付きで、下の行は続きの -low
  for (let y = area.y; y < solid.y; y += 1) {
    const suffix = y === area.y ? '' : '-low'
    for (let x = left; x <= right; x += 1) {
      cells.push({ cell: { x, y }, key: `roof-${roof}-${side(x, left, right)}${suffix}` })
    }
  }
  const wallTop = solid.y
  const wallBottom = solid.y + solid.h - 1
  for (let y = wallTop; y <= wallBottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      // 壁行が 1 段しかない家では扉を優先する(扉の無い家は作らない規約)
      if (y === wallBottom) {
        const width = structure.doorWidth ?? 1
        const isDoor =
          x >= doorX && x < doorX + width && doorX >= left && doorX + width - 1 <= right
        const doorKey: SpriteKey = width === 1 ? 'door' : x === doorX ? 'entrance-l' : 'entrance-r'
        cells.push({ cell: { x, y }, key: isDoor ? doorKey : wallKey(x, left, right) })
        continue
      }
      if (y === wallTop) {
        // 内側は 1 マスおきに窓。端の列は壁のまま
        const isEdge = x === left || x === right
        const isWindow = !isEdge && (x - area.x) % 2 === 1
        cells.push({ cell: { x, y }, key: isWindow ? 'window' : wallKey(x, left, right) })
        continue
      }
      cells.push({ cell: { x, y }, key: wallKey(x, left, right) })
    }
  }
  return cells
}
