// 地点の順番・到達可能性・歩数・ワープの検査(validateWorldSet)のテスト
import type { Tile } from '@content/types/world'
import { validateWorldSet, MAX_STEPS_TO_SPOT } from './validate-world'
import { tinyTown, townSet, pairSet } from './validate-world.fixture'

describe('validateWorldSet (順番・到達・ワープ)', () => {
  it('order が 1..n の連番でなければ報告する', () => {
    const set = townSet({
      spots: [
        { id: 's1', structureId: 'h1', cell: { x: 2, y: 2 }, facing: 'up', order: 1 },
        { id: 's2', structureId: 'h1', cell: { x: 3, y: 2 }, facing: 'up', order: 3 },
      ],
    })
    expect(validateWorldSet(set)).toContain(
      '地点の order が全ワールド通しの 1..2 の連番になっていない'
    )
  })
  it('order の欠けはワールドをまたいでも報告する', () => {
    const set = pairSet({
      town: {
        spots: [{ id: 's1', structureId: 'h1', cell: { x: 2, y: 2 }, facing: 'up', order: 3 }],
      },
    })
    expect(validateWorldSet(set)).toContain(
      '地点の order が全ワールド通しの 1..2 の連番になっていない'
    )
  })
  it('開始セルから到達できない地点を報告する', () => {
    // 地点の前の行を water で塞ぐ
    const tiles = tinyTown().tiles.map(row => [...row])
    tiles[3] = ['path', 'water', 'water', 'water', 'water']
    tiles[2] = ['water', 'grass', 'grass', 'grass', 'grass']
    expect(validateWorldSet(townSet({ tiles }))).toContain(
      'ワールド "town": 地点 "s1" に開始セルから到達できない'
    )
  })
  it('地点が開始セルから MAX_STEPS_TO_SPOT 歩より遠ければ報告する', () => {
    // 20x4。列 10 を water で塞ぎ、迂回で 23 歩かかる位置に地点を置く
    const rowOf = (blocked: boolean): Tile[] =>
      Array.from({ length: 20 }, (_, x): Tile => (blocked && x === 10 ? 'water' : 'grass'))
    const far = townSet({
      width: 20,
      height: 4,
      start: { x: 0, y: 0 },
      tiles: [rowOf(true), rowOf(true), rowOf(false), rowOf(false)],
      structures: [{ id: 'b1', kind: 'bench', cell: { x: 18, y: 3 } }],
      spots: [{ id: 's1', structureId: 'b1', cell: { x: 19, y: 0 }, facing: 'down', order: 1 }],
    })
    expect(
      validateWorldSet(far).some(
        m =>
          m.startsWith('ワールド "town": 地点 "s1" が開始セルから') &&
          m.includes(`上限 ${MAX_STEPS_TO_SPOT}`)
      )
    ).toBe(true)
  })
  it('屋内は歩数・到達可能性を検査しない', () => {
    // 机とベッドで囲って地点(3,0)へ歩いて行けない形にしても、屋内なら通す
    const set = pairSet({
      room: {
        start: { x: 0, y: 2 },
        structures: [
          { id: 'desk', kind: 'desk', cell: { x: 0, y: 0 } },
          { id: 'bed', kind: 'bed', cell: { x: 3, y: 1 } },
        ],
        warps: [],
      },
    })
    expect(validateWorldSet(set)).toEqual([])
  })
  it('ワープの移動先ワールドが無ければ報告する', () => {
    const set = pairSet({
      room: {
        warps: [
          {
            id: 'exit',
            cell: { x: 3, y: 2 },
            target: { worldId: 'nowhere', cell: { x: 0, y: 3 }, facing: 'down' },
          },
        ],
      },
    })
    expect(validateWorldSet(set)).toContain(
      'ワールド "room": ワープ "exit" の移動先ワールド "nowhere" が無い'
    )
  })
  it('ワープの移動先が通行不可なら報告する', () => {
    const set = pairSet({
      room: {
        warps: [
          {
            id: 'exit',
            cell: { x: 3, y: 2 },
            target: { worldId: 'town', cell: { x: 2, y: 1 }, facing: 'down' },
          },
        ],
      },
    })
    expect(validateWorldSet(set)).toContain(
      'ワールド "room": ワープ "exit" の移動先 "town" (2,1) が通行不可'
    )
  })
  it('壁の扉(通行不可)でも隣接に通路があればワープとして許す', () => {
    const set = pairSet({
      room: {
        tiles: [
          ['floor', 'floor', 'floor', 'floor'],
          ['floor', 'floor', 'floor', 'floor'],
          ['floor', 'floor', 'floor', 'doorway'],
        ],
        warps: [
          {
            id: 'exit',
            cell: { x: 3, y: 2 },
            target: { worldId: 'town', cell: { x: 0, y: 3 }, facing: 'down' },
          },
        ],
      },
    })
    expect(validateWorldSet(set)).toEqual([])
  })
  it('四方が通行不可のワープは報告する', () => {
    const set = pairSet({
      room: {
        tiles: [
          ['wall', 'wall', 'floor', 'floor'],
          ['wall', 'wall', 'floor', 'floor'],
          ['floor', 'floor', 'floor', 'floor'],
        ],
        warps: [
          {
            id: 'exit',
            cell: { x: 0, y: 0 },
            target: { worldId: 'town', cell: { x: 0, y: 3 }, facing: 'down' },
          },
        ],
      },
    })
    expect(validateWorldSet(set)).toContain('ワールド "room": ワープ "exit" に隣接する通路が無い')
  })
})
