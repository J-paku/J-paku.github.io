// 構造物展開 facadeCells のテスト
import type { Structure } from '@content/types/world'
import { facadeCells } from './facade'

// 指定行のスプライトを左から並べて返す
const row = (structure: Structure, y: number): string[] =>
  facadeCells(structure)
    .filter(c => c.cell.y === y)
    .sort((a, b) => a.cell.x - b.cell.x)
    .map(c => c.key)

type House = Extract<Structure, { kind: 'house' }>

const house: House = {
  id: 'h',
  kind: 'house',
  roof: 'red',
  area: { x: 2, y: 2, w: 4, h: 3 },
  solid: { x: 2, y: 3, w: 4, h: 2 },
  doorX: 3,
}

describe('facadeCells (house)', () => {
  it('屋根行は l / m / r になる', () => {
    expect(row(house, 2)).toEqual(['roof-red-l', 'roof-red-m', 'roof-red-m', 'roof-red-r'])
  })
  it('壁の最上段は端が壁・内側は 1 マスおきに窓', () => {
    expect(row(house, 3)).toEqual(['wall-l', 'window', 'wall-m', 'wall-r'])
  })
  it('幅 6 の壁最上段は窓が 2 つ', () => {
    const wide: House = {
      ...house,
      area: { x: 2, y: 2, w: 6, h: 3 },
      solid: { x: 2, y: 3, w: 6, h: 2 },
    }
    expect(row(wide, 3)).toEqual(['wall-l', 'window', 'wall-m', 'window', 'wall-m', 'wall-r'])
  })
  it('壁の最下段は doorX の列だけ扉', () => {
    expect(row(house, 4)).toEqual(['wall-l', 'door', 'wall-m', 'wall-r'])
  })
  it('doorX が area の外なら扉を置かない', () => {
    expect(row({ ...house, doorX: 9 }, 4)).toEqual(['wall-l', 'wall-m', 'wall-m', 'wall-r'])
  })
  it('壁行が 3 段なら中段は l / m / r', () => {
    const tall: House = {
      ...house,
      area: { x: 2, y: 1, w: 4, h: 4 },
      solid: { x: 2, y: 2, w: 4, h: 3 },
    }
    expect(row(tall, 1)).toEqual(['roof-red-l', 'roof-red-m', 'roof-red-m', 'roof-red-r'])
    expect(row(tall, 2)).toEqual(['wall-l', 'window', 'wall-m', 'wall-r'])
    expect(row(tall, 3)).toEqual(['wall-l', 'wall-m', 'wall-m', 'wall-r'])
    expect(row(tall, 4)).toEqual(['wall-l', 'door', 'wall-m', 'wall-r'])
  })
  it('壁行が 1 段だけなら、その 1 段がそのまま扉行になる(窓行は無い)', () => {
    const oneWall: House = {
      ...house,
      area: { x: 2, y: 2, w: 4, h: 3 },
      solid: { x: 2, y: 4, w: 4, h: 1 },
    }
    expect(row(oneWall, 2)).toEqual(['roof-red-l', 'roof-red-m', 'roof-red-m', 'roof-red-r'])
    expect(row(oneWall, 3)).toEqual([
      'roof-red-l-low',
      'roof-red-m-low',
      'roof-red-m-low',
      'roof-red-r-low',
    ])
    expect(row(oneWall, 4)).toEqual(['wall-l', 'door', 'wall-m', 'wall-r'])
  })
  it('屋根が 2 段なら 2 段目は -low', () => {
    const tallRoof: House = {
      ...house,
      area: { x: 2, y: 1, w: 4, h: 4 },
      solid: { x: 2, y: 3, w: 4, h: 2 },
    }
    expect(row(tallRoof, 1)).toEqual(['roof-red-l', 'roof-red-m', 'roof-red-m', 'roof-red-r'])
    expect(row(tallRoof, 2)).toEqual([
      'roof-red-l-low',
      'roof-red-m-low',
      'roof-red-m-low',
      'roof-red-r-low',
    ])
    expect(row(tallRoof, 3)).toEqual(['wall-l', 'window', 'wall-m', 'wall-r'])
    expect(row(tallRoof, 4)).toEqual(['wall-l', 'door', 'wall-m', 'wall-r'])
  })
  it('幅 1 は l だけ、幅 2 は l と r', () => {
    const w1: House = {
      ...house,
      area: { x: 0, y: 0, w: 1, h: 2 },
      solid: { x: 0, y: 1, w: 1, h: 1 },
      doorX: 0,
    }
    const w2: House = {
      ...house,
      roof: 'blue',
      area: { x: 0, y: 0, w: 2, h: 2 },
      solid: { x: 0, y: 1, w: 2, h: 1 },
      doorX: 1,
    }
    expect(row(w1, 0)).toEqual(['roof-red-l'])
    expect(row(w2, 0)).toEqual(['roof-blue-l', 'roof-blue-r'])
    expect(row(w2, 1)).toEqual(['wall-l', 'door'])
  })
  it('area の全マスを過不足なく埋める', () => {
    expect(facadeCells(house)).toHaveLength(12)
  })
})

describe('facadeCells (bench / fountain)', () => {
  it('ベンチは cell と右隣の 2 マス', () => {
    const bench: Structure = { id: 'b', kind: 'bench', cell: { x: 1, y: 9 } }
    expect(facadeCells(bench)).toEqual([
      { cell: { x: 1, y: 9 }, key: 'bench-l' },
      { cell: { x: 2, y: 9 }, key: 'bench-r' },
    ])
  })
  it('噴水は 1 マス', () => {
    const fountain: Structure = { id: 'f', kind: 'fountain', cell: { x: 9, y: 12 } }
    expect(facadeCells(fountain)).toEqual([{ cell: { x: 9, y: 12 }, key: 'fountain' }])
  })
})

describe('facadeCells (屋内の家具)', () => {
  it('机は 3×2 を上段 tl/tm/tr・下段 bl/bm/br で埋める', () => {
    const desk: Structure = { id: 'd', kind: 'desk', cell: { x: 3, y: 2 } }
    expect(facadeCells(desk)).toEqual([
      { cell: { x: 3, y: 2 }, key: 'desk-tl' },
      { cell: { x: 4, y: 2 }, key: 'desk-tm' },
      { cell: { x: 5, y: 2 }, key: 'desk-tr' },
      { cell: { x: 3, y: 3 }, key: 'desk-bl' },
      { cell: { x: 4, y: 3 }, key: 'desk-bm' },
      { cell: { x: 5, y: 3 }, key: 'desk-br' },
    ])
  })
  it('ベッドは cell と真下の 2 マス', () => {
    const bed: Structure = { id: 'bd', kind: 'bed', cell: { x: 0, y: 5 } }
    expect(facadeCells(bed)).toEqual([
      { cell: { x: 0, y: 5 }, key: 'bed-t' },
      { cell: { x: 0, y: 6 }, key: 'bed-b' },
    ])
  })
  it('テーブルは 2×2', () => {
    const table: Structure = { id: 'tb', kind: 'table', cell: { x: 6, y: 5 } }
    expect(facadeCells(table)).toEqual([
      { cell: { x: 6, y: 5 }, key: 'table-tl' },
      { cell: { x: 7, y: 5 }, key: 'table-tr' },
      { cell: { x: 6, y: 6 }, key: 'table-bl' },
      { cell: { x: 7, y: 6 }, key: 'table-br' },
    ])
  })
})

describe('拡大した入口と家具', () => {
  it('2マスの開口部を隙間なく横に並べる', () => {
    expect(row({ ...house, doorWidth: 2 }, 4)).toEqual([
      'wall-l',
      'entrance-l',
      'entrance-r',
      'wall-r',
    ])
  })
  it('大型ベンチは4×2、噴水は2×2を重複なく描く', () => {
    for (const kind of ['bench', 'fountain'] as const) {
      const cells = facadeCells({ id: kind, kind, cell: { x: 2, y: 3 }, scale: 2 })
      const width = kind === 'bench' ? 4 : 2
      expect(cells).toHaveLength(width * 2)
      expect(new Set(cells.map(c => c.cell.x + ',' + c.cell.y)).size).toBe(width * 2)
      expect(Math.max(...cells.map(c => c.cell.x))).toBe(2 + width - 1)
      expect(Math.max(...cells.map(c => c.cell.y))).toBe(4)
    }
  })
})
