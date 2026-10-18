// 出発点から 4 方向 BFS で歩いて届くマスを、見つけた順(歩数の少ない順)に1つずつ出す。
// 経路探索(path.ts)と、村ワールドの検査の歩数(src/lib/content/validate-world.ts)が同じ探索を使う
import type { Cell, World } from '@content/types/world'
import { isWalkable } from './collision'

// 届いたマス。steps は出発点からの歩数、from は1歩手前(出発点は null)。from を辿ると出発点へ戻る
export type Reach = { cell: Cell; steps: number; from: Reach | null }

const key = (c: Cell): string => `${c.x},${c.y}`
// 隣のマスを調べる順は右・左・下・上。同じ歩数のマスは、この順で先に出会った方を先に出す
const NEIGHBORS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

// 出発点は通行可かどうかに関わらず歩数 0 で最初に出す。出発点へ戻る1歩は数えない(既に届いている)。
// 探索が終わることは、条件式の正しさではなく形で決まる。
// - 隣のマスは tiles と同じ形に並べたマス目から引く。マップの外は引けずに undefined になり、外へは広がらない
// - 届いたマスは Map に1度だけ入る(同じキーで入れ直しても項目は増えない)。for...of は回っている間に足した項目も拾うので、
//   この Map がそのまま BFS の待ち行列になり、回る数はマス目の数(と出発点)を超えない
export function* reachCells(world: World, start: Cell): Generator<Reach> {
  const grid = world.tiles.map((row, y) => row.map((_, x) => ({ x, y })))
  const reached = new Map<string, Reach>([[key(start), { cell: start, steps: 0, from: null }]])
  for (const here of reached.values()) {
    yield here
    for (const d of NEIGHBORS) {
      const next = grid[here.cell.y + d.y]?.[here.cell.x + d.x]
      if (next === undefined || reached.has(key(next)) || !isWalkable(world, next)) continue
      reached.set(key(next), { cell: next, steps: here.steps + 1, from: here })
    }
  }
}
