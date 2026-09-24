// 経路探索 findPath のテスト
import { vi } from 'vitest'
import type { Cell, World } from '@content/types/world'
import { findPath, nearestReachable } from './path'

// server-only は Next.js のビルド境界専用ガードで、vitest(node 環境)では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の @/lib/content/read を素通しにする
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

// 実ワールドセットの town を取得。無ければテスト側で即座に落とし、以降の型を World に保つ
const realTownOrUndefined = readWorldSet().worlds.town
if (realTownOrUndefined === undefined) throw new Error('worldSet に town が無い')
const realTown: World = realTownOrUndefined

const world: World = {
  id: 't',
  kind: 'exterior',
  width: 4,
  height: 3,
  start: { x: 0, y: 2 },
  startFacing: 'up',
  tiles: [
    ['grass', 'water', 'grass', 'grass'],
    ['grass', 'water', 'grass', 'grass'],
    ['path', 'path', 'path', 'path'],
  ],
  structures: [],
  spots: [],
  warps: [],
}

describe('findPath', () => {
  it('最短経路を返す(from を含まず to を含む)', () => {
    expect(findPath(world, { x: 0, y: 2 }, { x: 2, y: 2 })).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ])
  })
  it('迂回が必要なら迂回する', () => {
    const path = findPath(world, { x: 0, y: 0 }, { x: 2, y: 0 })
    expect(path?.at(-1)).toEqual({ x: 2, y: 0 })
    expect(path?.length).toBe(6)
  })
  it('to が通行不可なら null(近くへ寄らない)', () => {
    expect(findPath(world, { x: 0, y: 2 }, { x: 1, y: 0 })).toBeNull()
  })
  it('from === to は空配列', () => {
    expect(findPath(world, { x: 0, y: 2 }, { x: 0, y: 2 })).toEqual([])
  })
  it('分岐があっても最短経路を返す(直線上の障害物を迂回する 6 マスが最短)', () => {
    // 5×5 の開けた部屋。中央 1 マスだけ壁(water)にして、直線ルートと迂回ルートの分岐を作る
    const room: World = {
      id: 'room5',
      kind: 'exterior',
      width: 5,
      height: 5,
      start: { x: 0, y: 0 },
      startFacing: 'down',
      tiles: [
        ['path', 'path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path', 'path'],
        ['path', 'path', 'water', 'path', 'path'],
        ['path', 'path', 'path', 'path', 'path'],
        ['path', 'path', 'path', 'path', 'path'],
      ],
      structures: [],
      spots: [],
      warps: [],
    }
    expect(findPath(room, { x: 0, y: 2 }, { x: 4, y: 2 })).toHaveLength(6)
  })
  it('通行可でも囲まれて届かない目的地は null(到達済みの空経路と区別する)', () => {
    // 中央の十字だけが水。四隅の草は通行可だが、どの隅からも他の隅へは行けない
    const isles: World = {
      id: 'isles',
      kind: 'exterior',
      width: 3,
      height: 3,
      start: { x: 0, y: 0 },
      startFacing: 'down',
      tiles: [
        ['grass', 'water', 'grass'],
        ['water', 'water', 'water'],
        ['grass', 'water', 'grass'],
      ],
      structures: [],
      spots: [],
      warps: [],
    }
    // 目的地そのものは通行可なので、入口のガードではなく探索の打ち切りだけが null を出せる。
    // 到達不能を空配列で返すと「その場から動かない」経路と区別が付かなくなる
    expect(findPath(isles, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull()
  })
})

// 合成ワールドは structures が空で、構造物の占有マスを一度も避けていない。実データの町で押さえる
describe('findPath (実際の worldSet — 構造物の回避)', () => {
  it('家を挟んだ 2 点の経路は、家の占有マスを 1 つも通らない', () => {
    const meishi = realTown.structures.find(s => s.id === 'meishi')
    if (meishi === undefined || meishi.kind !== 'house') throw new Error('meishi の家が無い')
    const { area } = meishi
    // 家(x4-7 / y2-5)の西 (3,3) と東 (8,3)。タイルはどちらも草で、塞いでいるのは構造物だけ
    const path = findPath(realTown, { x: 3, y: 3 }, { x: 8, y: 3 })
    if (path === null) throw new Error('家の west-east を結ぶ経路が見つからない')
    expect(path.at(-1)).toEqual({ x: 8, y: 3 })
    const insideHouse = (c: Cell): boolean =>
      c.x >= area.x && c.x < area.x + area.w && c.y >= area.y && c.y < area.y + area.h
    expect(path.filter(insideHouse)).toEqual([])
    // 北は外周の木で塞がっているので南の道へ迂回する。直進なら 5 歩のところが 11 歩になる
    expect(path).toHaveLength(11)
  })
})

describe('nearestReachable', () => {
  // 3×3 の広場の中央に 1×1 の構造物(郵便ポスト)を置く。塞いでいるのはタイルではなく構造物だけ
  const plaza: World = {
    id: 'plaza3',
    kind: 'exterior',
    width: 3,
    height: 3,
    start: { x: 0, y: 1 },
    startFacing: 'right',
    tiles: [
      ['path', 'path', 'path'],
      ['path', 'path', 'path'],
      ['path', 'path', 'path'],
    ],
    structures: [{ id: 'post', kind: 'mailbox', cell: { x: 1, y: 1 } }],
    spots: [],
    warps: [],
  }

  it('target が歩いて届くマスなら target そのもの', () => {
    expect(nearestReachable(world, { x: 0, y: 2 }, { x: 3, y: 0 })).toEqual({ x: 3, y: 0 })
  })
  it('target が構造物なら、隣の届くマスのうち from から先に出会う方', () => {
    // 西隣 (0,1) から押すと、自分がもう距離 1 で、それより近い届くマスは無いので動かない
    expect(nearestReachable(plaza, { x: 0, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 0, y: 1 })
    // 角 (0,0) からは距離 2 の自分より、BFS で先に出会う東の (1,0)(距離 1)へ寄る
    expect(nearestReachable(plaza, { x: 0, y: 0 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 0 })
  })
  it('target がワールドの外なら、届くマスのうち最も近い縁のマス', () => {
    expect(nearestReachable(world, { x: 0, y: 2 }, { x: 10, y: 2 })).toEqual({ x: 3, y: 2 })
  })
  it('from === target なら from', () => {
    expect(nearestReachable(world, { x: 2, y: 1 }, { x: 2, y: 1 })).toEqual({ x: 2, y: 1 })
  })
  it('水で隔てられた向こう岸は選ばず、こちら側で最も近いマスに留まる', () => {
    // 四隅の島の (0,0) からは自分しか届かない。対岸の (2,0) を押しても動かない
    const isles: World = {
      ...plaza,
      id: 'isles',
      tiles: [
        ['grass', 'water', 'grass'],
        ['water', 'water', 'water'],
        ['grass', 'water', 'grass'],
      ],
      structures: [],
    }
    expect(nearestReachable(isles, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual({ x: 0, y: 0 })
  })
})
