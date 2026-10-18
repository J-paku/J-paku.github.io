// 歩いて届くマスを見つけた順に出す BFS(reachCells)のテスト
import type { Cell, World } from '@content/types/world'
import { reachCells } from './reach-cells'

// 出した順に、マス・歩数・1歩手前のマス(出発点は null)を並べる
const trace = (world: World, start: Cell) =>
  Array.from(reachCells(world, start), r => ({
    cell: r.cell,
    steps: r.steps,
    from: r.from === null ? null : r.from.cell,
  }))

// 3×3 の開けた広場。左上の角だけが水
const plaza: World = {
  id: 'plaza3',
  kind: 'exterior',
  width: 3,
  height: 3,
  start: { x: 1, y: 1 },
  startFacing: 'down',
  tiles: [
    ['water', 'path', 'path'],
    ['path', 'path', 'path'],
    ['path', 'path', 'path'],
  ],
  structures: [],
  spots: [],
  warps: [],
}

describe('reachCells', () => {
  it('中央から出すと、右・左・下・上の順に歩数の少ないマスから出し、1歩手前は最初に出会ったマス', () => {
    // 2 歩目の (2,2) へは (2,1) と (1,2) の両方から1歩で行ける。先に調べた (2,1) から来たことにし、後から上書きしない
    expect(trace(plaza, { x: 1, y: 1 })).toEqual([
      { cell: { x: 1, y: 1 }, steps: 0, from: null },
      { cell: { x: 2, y: 1 }, steps: 1, from: { x: 1, y: 1 } },
      { cell: { x: 0, y: 1 }, steps: 1, from: { x: 1, y: 1 } },
      { cell: { x: 1, y: 2 }, steps: 1, from: { x: 1, y: 1 } },
      { cell: { x: 1, y: 0 }, steps: 1, from: { x: 1, y: 1 } },
      { cell: { x: 2, y: 2 }, steps: 2, from: { x: 2, y: 1 } },
      { cell: { x: 2, y: 0 }, steps: 2, from: { x: 2, y: 1 } },
      { cell: { x: 0, y: 2 }, steps: 2, from: { x: 0, y: 1 } },
    ])
  })
  it('四辺の縁から外へは広がらない(水の角は出さない)', () => {
    // 右下の角から出す。右と下はマップの外、左上の (0,0) は水
    expect(trace(plaza, { x: 2, y: 2 }).map(r => r.cell)).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ])
  })
  it('構造物の占有マスは出さない', () => {
    const withPost: World = {
      ...plaza,
      structures: [{ id: 'post', kind: 'mailbox', cell: { x: 2, y: 1 } }],
    }
    expect(trace(withPost, { x: 2, y: 2 }).map(r => r.cell)).not.toContainEqual({ x: 2, y: 1 })
  })
  it('出発点は通行不可でも歩数 0 で最初に出し、そこから隣へ広がる', () => {
    expect(trace(plaza, { x: 0, y: 0 })).toEqual([
      { cell: { x: 0, y: 0 }, steps: 0, from: null },
      { cell: { x: 1, y: 0 }, steps: 1, from: { x: 0, y: 0 } },
      { cell: { x: 0, y: 1 }, steps: 1, from: { x: 0, y: 0 } },
      { cell: { x: 2, y: 0 }, steps: 2, from: { x: 1, y: 0 } },
      { cell: { x: 1, y: 1 }, steps: 2, from: { x: 1, y: 0 } },
      { cell: { x: 0, y: 2 }, steps: 2, from: { x: 0, y: 1 } },
      { cell: { x: 2, y: 1 }, steps: 3, from: { x: 2, y: 0 } },
      { cell: { x: 1, y: 2 }, steps: 3, from: { x: 1, y: 1 } },
      { cell: { x: 2, y: 2 }, steps: 4, from: { x: 2, y: 1 } },
    ])
  })
  it('四方を塞がれた出発点は自分だけを出す', () => {
    const cornered: World = {
      ...plaza,
      tiles: [
        ['path', 'water', 'path'],
        ['water', 'path', 'path'],
        ['path', 'path', 'path'],
      ],
    }
    expect(trace(cornered, { x: 0, y: 0 })).toEqual([
      { cell: { x: 0, y: 0 }, steps: 0, from: null },
    ])
  })
})
