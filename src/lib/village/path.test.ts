// 経路探索 findPath のテスト
import type { World } from '@content/types/world'
import { findPath } from './path'

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
})
