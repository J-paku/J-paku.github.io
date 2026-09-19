// 会話地点 spotAt・allSpots・nextSpot・spotWorldId のテスト
import type { World, WorldSet } from '@content/types/world'
import { spotAt, allSpots, nextSpot, spotWorldId } from './spot'

// 屋内 1 地点。order は全ワールド通しの 1 番
const room: World = {
  id: 'room',
  kind: 'interior',
  width: 4,
  height: 3,
  start: { x: 3, y: 0 },
  startFacing: 'left',
  tiles: [
    ['floor', 'floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor', 'mat'],
  ],
  structures: [{ id: 'd', kind: 'desk', cell: { x: 0, y: 0 } }],
  spots: [{ id: 'home', structureId: 'd', cell: { x: 3, y: 0 }, facing: 'left', order: 1 }],
  warps: [
    {
      id: 'exit',
      cell: { x: 3, y: 2 },
      target: { worldId: 'town', cell: { x: 0, y: 2 }, facing: 'down' },
    },
  ],
}

const town: World = {
  id: 'town',
  kind: 'exterior',
  width: 3,
  height: 3,
  start: { x: 0, y: 2 },
  startFacing: 'up',
  tiles: [
    ['grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass'],
    ['path', 'path', 'path'],
  ],
  structures: [
    { id: 'f', kind: 'mailbox', cell: { x: 1, y: 0 } },
    { id: 'b', kind: 'robot', cell: { x: 0, y: 2 } },
  ],
  // 定義の並びを order と逆にして、並べ替えが効いているか見る
  spots: [
    { id: 'third', structureId: 'b', cell: { x: 2, y: 2 }, facing: 'left', order: 3 },
    { id: 'second', structureId: 'f', cell: { x: 1, y: 1 }, facing: 'up', order: 2 },
  ],
  warps: [],
}

const set: WorldSet = { id: 'test-set', startWorldId: 'room', worlds: { room, town } }

describe('spotAt', () => {
  it('立ち位置が一致する地点を返す(向きは問わない)', () => {
    expect(spotAt(town, { x: 1, y: 1 })?.id).toBe('second')
  })
  it('地点でないマスは null', () => {
    expect(spotAt(room, { x: 3, y: 2 })).toBeNull()
  })
})

describe('allSpots', () => {
  it('全ワールドの地点を order の昇順で返す', () => {
    expect(allSpots(set).map(s => s.id)).toEqual(['home', 'second', 'third'])
  })
})

describe('nextSpot', () => {
  it('ワールドをまたいで order + 1 の地点を返す', () => {
    expect(nextSpot(set, room.spots[0])).toEqual({ worldId: 'town', spot: town.spots[1] })
  })
  it('同じワールド内の次の地点も返す', () => {
    expect(nextSpot(set, town.spots[1])?.spot.id).toBe('third')
  })
  it('最後の地点なら null', () => {
    expect(nextSpot(set, town.spots[0])).toBeNull()
  })
})

describe('spotWorldId', () => {
  it('地点 id が属するワールド id を返す', () => {
    expect(spotWorldId(set, 'home')).toBe('room')
    expect(spotWorldId(set, 'third')).toBe('town')
  })
  it('無い地点は null', () => {
    expect(spotWorldId(set, 'ghost')).toBeNull()
  })
})

// 物の占有矩形を囲む通路から、全方向で会話できる
describe('spotAt (全方向)', () => {
  const field: World = {
    id: 'field',
    kind: 'exterior',
    width: 10,
    height: 8,
    start: { x: 4, y: 2 },
    startFacing: 'down',
    tiles: Array.from({ length: 8 }, () => Array(10).fill('grass')),
    structures: [{ id: 't', kind: 'table', cell: { x: 3, y: 3 } }],
    spots: [{ id: 'table', structureId: 't', cell: { x: 4, y: 2 }, facing: 'down', order: 1 }],
    warps: [],
  }
  it.each([
    { x: 3, y: 2 },
    { x: 4, y: 5 },
    { x: 2, y: 3 },
    { x: 5, y: 4 },
  ])('四辺の通路から話せる: %o', cell => {
    expect(spotAt(field, cell)?.id).toBe('table')
  })
  it.each([
    { x: 2, y: 2 },
    { x: 3, y: 3 },
    { x: 4, y: 1 },
    { x: -1, y: 3 },
  ])('斜め・内部・遠方・地図外からは話せない: %o', cell => {
    expect(spotAt(field, cell)).toBeNull()
  })
  it('隣接していても水や壁の上からは話せない', () => {
    const tiles = field.tiles.map(row => [...row])
    tiles[2][4] = 'water'
    expect(spotAt({ ...field, tiles }, { x: 4, y: 2 })).toBeNull()
  })
  it('建物は入口の幅だけ会話でき、側面・背面の壁越しには話せない', () => {
    const house: World = {
      ...field,
      structures: [
        {
          id: 'h',
          kind: 'house',
          roof: 'red',
          area: { x: 2, y: 1, w: 6, h: 3 },
          solid: { x: 2, y: 2, w: 6, h: 2 },
          doorX: 4,
          doorWidth: 2,
        },
      ],
      spots: [{ id: 'house', structureId: 'h', cell: { x: 4, y: 4 }, facing: 'up', order: 1 }],
    }
    expect(spotAt(house, { x: 5, y: 4 })?.id).toBe('house')
    expect(spotAt(house, { x: 3, y: 4 })).toBeNull()
    expect(spotAt(house, { x: 1, y: 2 })).toBeNull()
    expect(spotAt(house, { x: 4, y: 0 })).toBeNull()
  })
  it('入口の右端マスは話せるが、その1マス外は話せない(境界のガード)', () => {
    const house: World = {
      ...field,
      structures: [
        {
          id: 'h',
          kind: 'house',
          roof: 'red',
          area: { x: 2, y: 1, w: 6, h: 3 },
          solid: { x: 2, y: 2, w: 6, h: 2 },
          doorX: 4,
          doorWidth: 2,
        },
      ],
      spots: [{ id: 'house', structureId: 'h', cell: { x: 4, y: 4 }, facing: 'up', order: 1 }],
    }
    // 入口は x=4,5 の 2 マス。右端(5)は話せて、その次(6)は入口の外
    expect(spotAt(house, { x: 5, y: 4 })?.id).toBe('house')
    expect(spotAt(house, { x: 6, y: 4 })).toBeNull()
  })
})
