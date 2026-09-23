// 通行判定 isWalkable のテスト
import type { World } from '@content/types/world'
import { isWalkable } from './collision'

const world: World = {
  id: 't',
  kind: 'exterior',
  width: 5,
  height: 4,
  start: { x: 0, y: 3 },
  startFacing: 'up',
  tiles: [
    ['grass', 'grass', 'grass', 'water', 'tree'],
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
    { id: 'r', kind: 'robot', cell: { x: 0, y: 2 } },
    { id: 'm', kind: 'mailbox', cell: { x: 3, y: 3 } },
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
  it('water / tree / fence は不可', () => {
    expect(isWalkable(world, { x: 3, y: 0 })).toBe(false)
    expect(isWalkable(world, { x: 4, y: 0 })).toBe(false)
    expect(isWalkable(world, { x: 4, y: 2 })).toBe(false)
  })
  it('マップ外は不可', () => {
    expect(isWalkable(world, { x: -1, y: 0 })).toBe(false)
    expect(isWalkable(world, { x: 0, y: 4 })).toBe(false)
  })
  it('右端の外(x === width)は不可、幅を超えた列がタイル的に通行可能でも弾く(境界のガード)', () => {
    // tiles の行に width を超える余分な列を仕込み、範囲外ガードがタイル判定より先に効くか確認する
    const edge: World = {
      id: 'edge',
      kind: 'exterior',
      width: 3,
      height: 1,
      start: { x: 0, y: 0 },
      startFacing: 'down',
      tiles: [['grass', 'grass', 'grass', 'grass']],
      structures: [],
      spots: [],
      warps: [],
    }
    expect(isWalkable(edge, { x: edge.width, y: 0 })).toBe(false)
    expect(isWalkable(edge, { x: edge.width - 1, y: 0 })).toBe(true)
  })
  it('家は area 全体が不可(屋根行にも立てない)', () => {
    expect(isWalkable(world, { x: 1, y: 1 })).toBe(false)
    expect(isWalkable(world, { x: 1, y: 0 })).toBe(false)
  })
  it('ロボットは cell の 1 マスが不可', () => {
    expect(isWalkable(world, { x: 0, y: 2 })).toBe(false)
    expect(isWalkable(world, { x: 1, y: 2 })).toBe(true)
  })
  it('ポストの 1 マスは不可', () => {
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

// 経歴碑(2×2)と石碑(1×2)だけを置いた広場
const plaza: World = {
  id: 'plaza',
  kind: 'exterior',
  width: 6,
  height: 6,
  start: { x: 0, y: 5 },
  startFacing: 'up',
  tiles: Array.from({ length: 6 }, () => Array(6).fill('grass')),
  structures: [
    { id: 'mon', kind: 'monument', cell: { x: 1, y: 1 } },
    { id: 'st', kind: 'stele', cell: { x: 4, y: 1 } },
    { id: 'lp', kind: 'lamp', cell: { x: 0, y: 4 } },
  ],
  spots: [],
  warps: [],
}

describe('isWalkable (経歴碑・石碑)', () => {
  it('経歴碑は cell から 2×2 の全マスが不可、真下の行は通行可', () => {
    expect(isWalkable(plaza, { x: 1, y: 1 })).toBe(false)
    expect(isWalkable(plaza, { x: 2, y: 1 })).toBe(false)
    expect(isWalkable(plaza, { x: 1, y: 2 })).toBe(false)
    expect(isWalkable(plaza, { x: 2, y: 2 })).toBe(false)
    expect(isWalkable(plaza, { x: 1, y: 3 })).toBe(true)
  })
  it('石碑は cell とその真下のマスだけが不可', () => {
    expect(isWalkable(plaza, { x: 4, y: 1 })).toBe(false)
    expect(isWalkable(plaza, { x: 4, y: 2 })).toBe(false)
    expect(isWalkable(plaza, { x: 4, y: 3 })).toBe(true)
    expect(isWalkable(plaza, { x: 5, y: 1 })).toBe(true)
  })
  it('街灯は灯のある cell の 1 マスだけが不可', () => {
    expect(isWalkable(plaza, { x: 0, y: 4 })).toBe(false)
    expect(isWalkable(plaza, { x: 1, y: 4 })).toBe(true)
  })
  it('街灯の真下(柱の根元が描かれるマス)は通行可', () => {
    expect(isWalkable(plaza, { x: 0, y: 5 })).toBe(true)
  })
})
