// 地図の扉の印 doorMarkers・isDoorVisited のテスト
import type { World, WorldSet } from '@content/types/world'
import { doorMarkers, isDoorVisited } from './door-marker'

// 実データ(content/world.ts)と同じ形の縮小版。自室にはコース地点 home と、コース外の時計がある
const room: World = {
  id: 'room',
  kind: 'interior',
  width: 3,
  height: 2,
  start: { x: 1, y: 0 },
  startFacing: 'up',
  tiles: [
    ['floor', 'floor', 'floor'],
    ['floor', 'mat', 'floor'],
  ],
  structures: [],
  spots: [
    { id: 'home', cell: { x: 1, y: 0 }, facing: 'up', order: 1 },
    { id: 'clock', cell: { x: 2, y: 0 }, facing: 'up', action: 'clock' },
  ],
  warps: [
    {
      id: 'exit',
      cell: { x: 1, y: 1 },
      target: { worldId: 'town', cell: { x: 1, y: 2 }, facing: 'down' },
    },
  ],
}

// 町は自宅の扉 (1,1) がワープ。地点(meishi)は町にあるので扉の印とは別に地図へ載る
const town: World = {
  id: 'town',
  kind: 'exterior',
  width: 3,
  height: 3,
  start: { x: 1, y: 2 },
  startFacing: 'down',
  tiles: [
    ['grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass'],
  ],
  structures: [
    {
      id: 'home',
      kind: 'house',
      roof: 'red',
      area: { x: 0, y: 0, w: 3, h: 2 },
      solid: { x: 0, y: 1, w: 3, h: 1 },
      doorX: 1,
    },
  ],
  spots: [{ id: 'meishi', cell: { x: 0, y: 2 }, facing: 'up', order: 2 }],
  warps: [
    {
      id: 'home',
      cell: { x: 1, y: 1 },
      target: { worldId: 'room', cell: { x: 1, y: 0 }, facing: 'up' },
    },
  ],
}

const homeSet: WorldSet = { id: 'test', startWorldId: 'room', worlds: { room, town } }

describe('doorMarkers(自宅)', () => {
  it('町の自宅の扉に印を 1 つ置き、中身は自室のコース地点 home だけ', () => {
    expect(doorMarkers(homeSet, town)).toEqual([
      { id: 'home', cell: { x: 1, y: 1 }, spotIds: ['home'] },
    ])
  })

  it('屋内(自室)の地図には扉の印を置かない', () => {
    expect(doorMarkers(homeSet, room)).toEqual([])
  })

  it('home を訪ねるまで未訪問、訪ねたら訪問済み(コース外の clock は問わない)', () => {
    const [marker] = doorMarkers(homeSet, town)
    expect(isDoorVisited(marker, new Set())).toBe(false)
    expect(isDoorVisited(marker, new Set(['clock', 'meishi']))).toBe(false)
    expect(isDoorVisited(marker, new Set(['home']))).toBe(true)
  })
})

describe('doorMarkers(境界)', () => {
  const base: World = {
    id: 'town',
    kind: 'exterior',
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    startFacing: 'down',
    tiles: [['grass', 'grass']],
    structures: [],
    spots: [],
    warps: [
      {
        id: 'a',
        cell: { x: 0, y: 0 },
        target: { worldId: 'shed', cell: { x: 0, y: 0 }, facing: 'up' },
      },
      {
        id: 'b',
        cell: { x: 1, y: 0 },
        target: { worldId: 'yard', cell: { x: 0, y: 0 }, facing: 'up' },
      },
    ],
  }
  const shed: World = {
    ...base,
    id: 'shed',
    kind: 'interior',
    warps: [],
    spots: [{ id: 'clock', cell: { x: 0, y: 0 }, facing: 'up', action: 'clock' }],
  }
  const yard: World = {
    ...base,
    id: 'yard',
    warps: [],
    spots: [{ id: 'y', cell: { x: 0, y: 0 }, facing: 'up', order: 1 }],
  }
  const set: WorldSet = { id: 't', startWorldId: 'town', worlds: { town: base, shed, yard } }

  it('コース地点の無い屋内・屋外への扉・存在しない行き先には印を置かない', () => {
    expect(doorMarkers(set, base)).toEqual([])
    const missing: World = {
      ...base,
      warps: [{ ...base.warps[0], target: { ...base.warps[0].target, worldId: 'none' } }],
    }
    expect(doorMarkers(set, missing)).toEqual([])
  })

  it('屋内に複数のコース地点があれば、全部訪ねるまで訪問済みにしない', () => {
    const shed2: World = {
      ...shed,
      spots: [
        { id: 'p', cell: { x: 0, y: 0 }, facing: 'up', order: 1 },
        { id: 'q', cell: { x: 1, y: 0 }, facing: 'up', order: 2 },
      ],
    }
    const [marker] = doorMarkers({ ...set, worlds: { ...set.worlds, shed: shed2 } }, base)
    expect(marker.spotIds).toEqual(['p', 'q'])
    expect(isDoorVisited(marker, new Set(['p']))).toBe(false)
    expect(isDoorVisited(marker, new Set(['p', 'q']))).toBe(true)
  })
})
