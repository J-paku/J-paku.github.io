// 通行判定 isWalkable のテスト
import type { World } from '@content/types/world'
import { isWalkable, structureRect } from './collision'

const world: World = {
  id: 't',
  kind: 'exterior',
  width: 5,
  height: 4,
  start: { x: 0, y: 3 },
  startFacing: 'up',
  tiles: [
    ['grass', 'grass', 'grass', 'water', 'tree-tl'],
    ['grass', 'grass', 'grass', 'grass', 'flower'],
    ['grass', 'grass', 'grass', 'grass', 'fence'],
    ['path', 'path', 'plaza', 'plaza', 'grass-alt'],
  ],
  structures: [
    {
      id: 'h',
      kind: 'house',
      roof: 'red',
      area: { x: 1, y: 0, w: 2, h: 2 },
      solid: { x: 1, y: 1, w: 2, h: 1 },
      doorX: 1,
    },
    { id: 'b', kind: 'bench', cell: { x: 0, y: 2 } },
    { id: 'f', kind: 'fountain', cell: { x: 3, y: 3 } },
  ],
  spots: [],
  warps: [],
}

// 屋内の家具 3 種だけを置いた部屋。上端は壁、右下は出口マット
const room: World = {
  id: 'r',
  kind: 'interior',
  width: 8,
  height: 5,
  start: { x: 0, y: 4 },
  startFacing: 'up',
  tiles: [
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
    ['floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'floor', 'mat'],
  ],
  structures: [
    { id: 'd', kind: 'desk', cell: { x: 0, y: 1 } },
    { id: 'bd', kind: 'bed', cell: { x: 4, y: 1 } },
    { id: 'tb', kind: 'table', cell: { x: 6, y: 1 } },
  ],
  spots: [],
  warps: [],
}

describe('isWalkable', () => {
  it('grass / grass-alt / path / plaza / flower は通行可', () => {
    expect(isWalkable(world, { x: 0, y: 0 })).toBe(true)
    expect(isWalkable(world, { x: 4, y: 3 })).toBe(true)
    expect(isWalkable(world, { x: 0, y: 3 })).toBe(true)
    expect(isWalkable(world, { x: 2, y: 3 })).toBe(true)
    expect(isWalkable(world, { x: 4, y: 1 })).toBe(true)
  })
  it('floor / mat は通行可、wall は不可', () => {
    expect(isWalkable(room, { x: 3, y: 1 })).toBe(true)
    expect(isWalkable(room, { x: 7, y: 4 })).toBe(true)
    expect(isWalkable(room, { x: 0, y: 0 })).toBe(false)
  })
  it('water / tree-tl / fence は不可', () => {
    expect(isWalkable(world, { x: 3, y: 0 })).toBe(false)
    expect(isWalkable(world, { x: 4, y: 0 })).toBe(false)
    expect(isWalkable(world, { x: 4, y: 2 })).toBe(false)
  })
  it('マップ外は不可', () => {
    expect(isWalkable(world, { x: -1, y: 0 })).toBe(false)
    expect(isWalkable(world, { x: 0, y: 4 })).toBe(false)
  })
  it('家は area 全体が不可(屋根行にも立てない)', () => {
    expect(isWalkable(world, { x: 1, y: 1 })).toBe(false)
    expect(isWalkable(world, { x: 1, y: 0 })).toBe(false)
  })
  it('ベンチは cell と右隣の 2 マスが不可', () => {
    expect(isWalkable(world, { x: 0, y: 2 })).toBe(false)
    expect(isWalkable(world, { x: 1, y: 2 })).toBe(false)
    expect(isWalkable(world, { x: 2, y: 2 })).toBe(true)
  })
  it('噴水の 1 マスは不可', () => {
    expect(isWalkable(world, { x: 3, y: 3 })).toBe(false)
  })
  it('机は cell から 3×2 が不可', () => {
    expect(isWalkable(room, { x: 0, y: 1 })).toBe(false)
    expect(isWalkable(room, { x: 2, y: 2 })).toBe(false)
    expect(isWalkable(room, { x: 0, y: 3 })).toBe(true)
  })
  it('ベッドは cell と真下の 2 マスが不可', () => {
    expect(isWalkable(room, { x: 4, y: 1 })).toBe(false)
    expect(isWalkable(room, { x: 4, y: 2 })).toBe(false)
    expect(isWalkable(room, { x: 4, y: 3 })).toBe(true)
  })
  it('テーブルは cell から 2×2 が不可', () => {
    expect(isWalkable(room, { x: 6, y: 1 })).toBe(false)
    expect(isWalkable(room, { x: 7, y: 2 })).toBe(false)
    expect(isWalkable(room, { x: 7, y: 3 })).toBe(true)
  })
})

it('大型家具は絵と同じ矩形を占有する', () => {
  expect(structureRect({ id: 'b', kind: 'bench', cell: { x: 2, y: 3 }, scale: 2 })).toEqual({
    x: 2,
    y: 3,
    w: 4,
    h: 2,
  })
  expect(structureRect({ id: 'f', kind: 'fountain', cell: { x: 2, y: 3 }, scale: 2 })).toEqual({
    x: 2,
    y: 3,
    w: 2,
    h: 2,
  })
})
