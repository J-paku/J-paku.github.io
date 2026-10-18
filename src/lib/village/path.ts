// 4方向 BFS(reach-cells.ts)で経路と行き先を決める。マップが小さいので経路キャッシュは持たない
import type { Cell, World } from '@content/types/world'
import { reachCells, type Reach } from './reach-cells'

// 届いたマスから1歩手前を出発点まで辿り、出発点を含まず着いたマスを含む経路にする
const toPath = (reach: Reach): Cell[] =>
  reach.from === null ? [] : [...toPath(reach.from), reach.cell]

// 探索は出発点を最初に出すので、from === to は(四方を塞がれていても)そこで止まって空配列になる。
// 通行不可の to は探索が一度も出さないので、探し尽くして null になる
export const findPath = (world: World, from: Cell, to: Cell): Cell[] | null => {
  for (const reach of reachCells(world, from)) {
    if (reach.cell.x === to.x && reach.cell.y === to.y) return toPath(reach)
  }
  return null
}

// 地図で押したマスへ向かうときの行き先。押したマスが家・水・木でも止まらず、
// from から歩いて届くマスのうち押したマスに最も近いところで止まる(近さはマンハッタン距離)。
// 同じ近さなら探索が先に出したマス、つまり from から歩数の少ない方を選ぶ。
// 届くマスはすべて見る。距離 0 に着いた後も回るが、それより近いマスは無いので best は動かない
export const nearestReachable = (world: World, from: Cell, target: Cell): Cell | null => {
  const distance = (c: Cell): number => Math.abs(c.x - target.x) + Math.abs(c.y - target.y)
  let best: Cell = from
  for (const { cell } of reachCells(world, from)) {
    if (distance(cell) < distance(best)) best = cell
  }
  return best
}
