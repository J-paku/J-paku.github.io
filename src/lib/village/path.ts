// 4方向 BFS。マップが小さいので経路キャッシュは持たない
import type { Cell, World } from '@content/types/world'
import { isWalkable } from './collision'

const key = (c: Cell): string => `${c.x},${c.y}`
const NEIGHBORS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

// 通行不可の to は探索が一度も積まないので、探し尽くして null になる(入口で弾かなくても結果は同じ)。
// 出発点は seen に入れずに始める。隣から戻って来て積み直されても、経路の復元は出発点で止まり、
// その先のマスはどれも既に seen なので、返す経路は変わらない
export const findPath = (world: World, from: Cell, to: Cell): Cell[] | null => {
  if (from.x === to.x && from.y === to.y) return []
  const prev = new Map<string, Cell>()
  const seen = new Set<string>()
  const queue: Cell[] = [from]
  while (queue.length > 0) {
    const cur = queue.shift() as Cell
    for (const d of NEIGHBORS) {
      const next = { x: cur.x + d.x, y: cur.y + d.y }
      const k = key(next)
      if (seen.has(k) || !isWalkable(world, next)) continue
      seen.add(k)
      prev.set(k, cur)
      if (next.x === to.x && next.y === to.y) {
        const path: Cell[] = []
        // 出発点以外の積んだマスは必ず prev を持つので、出発点へ着くまで辿れば途切れない
        let c: Cell = next
        while (!(c.x === from.x && c.y === from.y)) {
          path.unshift(c)
          c = prev.get(key(c)) as Cell
        }
        return path
      }
      queue.push(next)
    }
  }
  return null
}

// 地図で押したマスへ向かうときの行き先。押したマスが家・水・木でも止まらず、
// from から歩いて届くマスのうち押したマスに最も近いところで止まる(近さはマンハッタン距離)。
// 同じ近さなら BFS で先に出会ったマス、つまり from から歩数の少ない方を選ぶ。
// 届くマスはすべて見る。距離 0 に着いた後も回るが、それより近いマスは無いので best は動かない。
// 出発点を seen に入れずに始めて戻って来ても、出発点は best より近くならないので同じく動かない
export const nearestReachable = (world: World, from: Cell, target: Cell): Cell | null => {
  const distance = (c: Cell): number => Math.abs(c.x - target.x) + Math.abs(c.y - target.y)
  let best: Cell = from
  let bestDistance = distance(from)
  const seen = new Set<string>()
  const queue: Cell[] = [from]
  while (queue.length > 0) {
    const cur = queue.shift() as Cell
    for (const d of NEIGHBORS) {
      const next = { x: cur.x + d.x, y: cur.y + d.y }
      const k = key(next)
      if (seen.has(k) || !isWalkable(world, next)) continue
      seen.add(k)
      const nextDistance = distance(next)
      if (nextDistance < bestDistance) {
        best = next
        bestDistance = nextDistance
      }
      queue.push(next)
    }
  }
  return best
}
