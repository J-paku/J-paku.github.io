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
})
