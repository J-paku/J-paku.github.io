// 村ワールドの構造・配置・id の整合性検査(validateWorldSet)のテスト
import type { Structure, Tile } from '@content/types/world'
import { validateWorldSet, MAX_HOUSES } from './validate-world'
import { worldSet } from '@content/world'
import { tinyTown, townSet, pairSet } from './validate-world.fixture'

describe('validateWorldSet', () => {
  it('整合した 1 ワールドの村は問題なし', () => {
    expect(validateWorldSet(townSet())).toEqual([])
  })
  it('整合した 2 ワールドの村は問題なし', () => {
    expect(validateWorldSet(pairSet())).toEqual([])
  })
  it('startWorldId が worlds に無ければ報告する', () => {
    expect(validateWorldSet({ ...townSet(), startWorldId: 'nowhere' })).toContain(
      '開始ワールド "nowhere" が worlds に無い'
    )
  })
  it('tiles の行数・列数が width/height と違えば報告する', () => {
    expect(validateWorldSet(townSet({ height: 5 }))).toContain(
      'ワールド "town": tiles の行数が height と一致しない'
    )
  })
  it('開始セルが通行不可なら報告する', () => {
    expect(validateWorldSet(townSet({ start: { x: 2, y: 1 } }))).toContain(
      'ワールド "town": 開始セルが通行不可'
    )
  })
  it('地点の structureId が存在しなければ報告する', () => {
    const set = townSet({
      spots: [{ id: 's1', structureId: 'nope', cell: { x: 2, y: 2 }, facing: 'up', order: 1 }],
    })
    expect(validateWorldSet(set)).toContain(
      'ワールド "town": 地点 "s1" の structureId "nope" が無い'
    )
  })
  it('地点の立ち位置が通行不可なら報告する', () => {
    const set = townSet({
      spots: [{ id: 's1', structureId: 'h1', cell: { x: 2, y: 1 }, facing: 'up', order: 1 }],
    })
    expect(validateWorldSet(set)).toContain('ワールド "town": 地点 "s1" の立ち位置が通行不可')
  })
  it('ワールドの大きさが上限を超えれば報告する', () => {
    const big = townSet({
      width: 31,
      tiles: tinyTown().tiles.map(row => [...row, ...Array<Tile>(26).fill('grass')]),
    })
    expect(validateWorldSet(big).some(m => m.includes('広さが上限'))).toBe(true)
  })
  it('家が MAX_HOUSES を超えれば報告する', () => {
    const house = (id: string): Structure => ({
      id,
      kind: 'house',
      roof: 'red',
      area: { x: 1, y: 0, w: 3, h: 2 },
      solid: { x: 1, y: 1, w: 3, h: 1 },
      doorX: 2,
    })
    const many = townSet({
      structures: [house('h1'), house('h2'), house('h3'), house('h4'), house('h5')],
    })
    expect(validateWorldSet(many)).toContain(
      `ワールド "town": 家が上限 ${MAX_HOUSES} 軒を超えている(5)`
    )
  })
  it('家の solid が area からはみ出れば報告する', () => {
    const set = townSet({
      structures: [
        {
          id: 'h1',
          kind: 'house',
          roof: 'red',
          area: { x: 1, y: 0, w: 3, h: 3 },
          solid: { x: 1, y: 1, w: 4, h: 1 },
          doorX: 2,
        },
      ],
    })
    expect(validateWorldSet(set)).toContain(
      'ワールド "town": 家 "h1" の solid が area の外にはみ出している'
    )
  })
  it('扉の列が area の外なら報告する', () => {
    const set = townSet({
      structures: [
        {
          id: 'h1',
          kind: 'house',
          roof: 'red',
          area: { x: 1, y: 0, w: 3, h: 3 },
          solid: { x: 1, y: 1, w: 3, h: 1 },
          doorX: 9,
        },
      ],
    })
    expect(validateWorldSet(set)).toContain('ワールド "town": 家 "h1" の扉 x=9 が area の範囲外')
  })
  it('扉が area の最も左・最も右の有効な列にあれば範囲外として報告しない', () => {
    const house = tinyTown().structures[0]
    if (house.kind !== 'house') throw new Error('fixture')
    const leftmost = townSet({ structures: [{ ...house, doorX: house.area.x }] })
    expect(validateWorldSet(leftmost).some(m => m.includes('扉'))).toBe(false)
    const rightmost = townSet({
      structures: [{ ...house, doorX: house.area.x + house.area.w - 1 }],
    })
    expect(validateWorldSet(rightmost).some(m => m.includes('扉'))).toBe(false)
  })
  it('ロボット・ポストがマップ外なら報告する', () => {
    const set = townSet({
      structures: [...tinyTown().structures, { id: 'b1', kind: 'robot', cell: { x: 5, y: 3 } }],
    })
    expect(validateWorldSet(set)).toContain('ワールド "town": 構造物 "b1" がマップ外にある')
  })
  it('机がマップ外にはみ出れば報告する', () => {
    const set = pairSet({
      room: { structures: [{ id: 'desk', kind: 'desk', cell: { x: 2, y: 0 } }] },
    })
    expect(validateWorldSet(set)).toContain('ワールド "room": 構造物 "desk" がマップ外にある')
  })
  it('地点 id の重複を報告する', () => {
    const set = townSet({
      spots: [
        { id: 's1', structureId: 'h1', cell: { x: 2, y: 2 }, facing: 'up', order: 1 },
        { id: 's1', structureId: 'h1', cell: { x: 3, y: 2 }, facing: 'up', order: 2 },
      ],
    })
    expect(validateWorldSet(set)).toContain('ワールド "town": 地点の id "s1" が重複')
  })
  it('構造物 id の重複を報告する', () => {
    const house = {
      id: 'h1',
      kind: 'house',
      roof: 'red',
      area: { x: 1, y: 0, w: 3, h: 2 },
      solid: { x: 1, y: 1, w: 3, h: 1 },
      doorX: 2,
    } as const
    expect(validateWorldSet(townSet({ structures: [house, house] }))).toContain(
      'ワールド "town": 構造物の id "h1" が重複'
    )
  })
  it('地点が構造物と同じ id を名乗るのは許す', () => {
    const set = townSet({
      spots: [{ id: 'h1', structureId: 'h1', cell: { x: 2, y: 2 }, facing: 'up', order: 1 }],
    })
    expect(validateWorldSet(set)).toEqual([])
  })
  it('実際の worldSet は問題なし', () => {
    expect(validateWorldSet(worldSet)).toEqual([])
  })
  it('建物の無い到着範囲を認め、代表地点の範囲外は拒む', () => {
    const spot = {
      id: 'exit',
      cell: { x: 2, y: 2 },
      facing: 'up' as const,
      arrivalArea: { x: 2, y: 2, w: 2, h: 1 },
    }
    expect(validateWorldSet(townSet({ spots: [spot] }))).toEqual([])
    expect(validateWorldSet(townSet({ spots: [{ ...spot, cell: { x: 1, y: 2 } }] }))).toContain(
      'ワールド "town": 地点 "exit" の arrivalArea が不正'
    )
  })
  it('経歴碑(monument)が実際の町に 2×2 の構造物として登録されている', () => {
    const monument = worldSet.worlds.town.structures.find(s => s.id === 'monument')
    expect(monument).toEqual({ id: 'monument', kind: 'monument', cell: { x: 16, y: 2 } })
  })
  it('経歴碑の会話地点は order を持たず、コース外の地点として登録されている', () => {
    const spot = worldSet.worlds.town.spots.find(s => s.id === 'monument')
    expect(spot).toEqual({
      id: 'monument',
      structureId: 'monument',
      cell: { x: 16, y: 4 },
      facing: 'up',
    })
  })
})

it('2マス入口が建物の幅をはみ出す配置は弾く', () => {
  const house = tinyTown().structures[0]
  if (house.kind !== 'house') throw new Error('fixture')
  const set = townSet({ structures: [{ ...house, doorX: 3, doorWidth: 2 }] })
  expect(validateWorldSet(set).some(m => m.includes('扉'))).toBe(true)
})
