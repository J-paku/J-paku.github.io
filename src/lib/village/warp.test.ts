// ワープ床 warpAt・指定したマスまでの経路 routeToCell・扉までの経路 routeToWarp のテスト
import type { World } from '@content/types/world'
import { routeToCell, routeToWarp, warpAt } from './warp'

const room: World = {
  id: 'room',
  kind: 'interior',
  width: 3,
  height: 3,
  start: { x: 0, y: 0 },
  startFacing: 'down',
  tiles: [
    ['floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor'],
    ['mat', 'floor', 'mat'],
  ],
  structures: [],
  spots: [],
  warps: [
    {
      id: 'exit',
      cell: { x: 0, y: 2 },
      target: { worldId: 'town', cell: { x: 9, y: 7 }, facing: 'down' },
    },
    {
      id: 'back',
      cell: { x: 2, y: 2 },
      target: { worldId: 'room', cell: { x: 0, y: 0 }, facing: 'up' },
    },
  ],
}

const town: World = { ...room, id: 'town', kind: 'exterior', warps: [] }

describe('warpAt', () => {
  it('ワープ床のマスならそのワープを返す', () => {
    expect(warpAt(room, { x: 0, y: 2 })?.id).toBe('exit')
    expect(warpAt(room, { x: 2, y: 2 })?.target.worldId).toBe('room')
  })
  it('ワープ床でないマスは null', () => {
    expect(warpAt(room, { x: 1, y: 2 })).toBeNull()
    expect(warpAt(room, { x: 0, y: 0 })).toBeNull()
  })
  it('ワープを持たないワールドは常に null', () => {
    expect(warpAt(town, { x: 0, y: 2 })).toBeNull()
  })
})

// 壁の扉(通行不可)が右上 (2,0) にある部屋。隣の (1,0) か (2,1) から扉へぶつかって出る
const walled: World = {
  ...room,
  tiles: [
    ['floor', 'floor', 'doorway'],
    ['floor', 'floor', 'floor'],
    ['floor', 'floor', 'floor'],
  ],
  warps: [
    {
      id: 'door',
      cell: { x: 2, y: 0 },
      target: { worldId: 'town', cell: { x: 9, y: 7 }, facing: 'down' },
    },
  ],
}

describe('routeToCell', () => {
  it('同じ行き先の扉が複数あっても指定した扉へ向かう', () => {
    const twoDoors: World = {
      ...walled,
      tiles: [['doorway', 'floor', 'doorway'], ...walled.tiles.slice(1)],
      warps: [{ ...walled.warps[0], id: 'near', cell: { x: 0, y: 0 } }, walled.warps[0]],
    }
    const route = routeToCell(twoDoors, { x: 0, y: 1 }, { x: 2, y: 0 })
    expect(route?.at(-1)).toEqual({ x: 2, y: 0 })
    expect(route).toHaveLength(3)
    // 扉の 1 歩手前は扉 (2,0) の隣のマス(マンハッタン距離 1)
    const side = route?.at(-2)
    if (side === undefined) throw new Error('扉の手前のマスが無い')
    expect(Math.abs(side.x - 2) + Math.abs(side.y - 0)).toBe(1)
  })
  // 扉の隣のマスを調べる順は右・左・下・上。同じ歩数で届く隣が並ぶ時は、先に調べた側から扉へぶつかる
  it('左右の隣へ同じ歩数で届くなら、右の隣から扉へぶつかる', () => {
    // 上の行の中央 (1,0) が扉。真下は水なので、下の (1,2) からは左右どちらへ回っても 3 歩
    const topDoor: World = {
      ...walled,
      tiles: [
        ['floor', 'doorway', 'floor'],
        ['floor', 'water', 'floor'],
        ['floor', 'floor', 'floor'],
      ],
      warps: [{ ...walled.warps[0], cell: { x: 1, y: 0 } }],
    }
    expect(routeToCell(topDoor, { x: 1, y: 2 }, { x: 1, y: 0 })).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
      { x: 1, y: 0 },
    ])
  })
  it('上下の隣へ同じ歩数で届くなら、下の隣から扉へぶつかる', () => {
    // 左の列の中央 (0,1) が扉。右隣は水なので、右の (2,1) からは上下どちらへ回っても 3 歩
    const sideDoor: World = {
      ...walled,
      tiles: [
        ['floor', 'floor', 'floor'],
        ['doorway', 'water', 'floor'],
        ['floor', 'floor', 'floor'],
      ],
      warps: [{ ...walled.warps[0], cell: { x: 0, y: 1 } }],
    }
    expect(routeToCell(sideDoor, { x: 2, y: 1 }, { x: 0, y: 1 })).toEqual([
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
    ])
  })
  it('上の隣しか空いていない扉へは、上の隣から下へぶつかる', () => {
    // 下の行の中央 (1,2) が扉。左右の隣は水なので、扉へ触れられるのは上の (1,1) だけ
    const bottomDoor: World = {
      ...walled,
      tiles: [
        ['floor', 'floor', 'floor'],
        ['floor', 'floor', 'floor'],
        ['water', 'doorway', 'water'],
      ],
      warps: [{ ...walled.warps[0], cell: { x: 1, y: 2 } }],
    }
    expect(routeToCell(bottomDoor, { x: 1, y: 0 }, { x: 1, y: 2 })).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ])
  })
  it('ワープでない壁は経路にせず、届かない扉も null', () => {
    expect(routeToCell({ ...walled, warps: [] }, walled.start, { x: 2, y: 0 })).toBeNull()
    expect(
      routeToCell(
        {
          ...walled,
          tiles: [
            ['floor', 'water', 'doorway'],
            ...walled.tiles.slice(1).map(row => row.map(() => 'water' as const)),
          ],
        },
        walled.start,
        { x: 2, y: 0 }
      )
    ).toBeNull()
  })
})

describe('routeToWarp', () => {
  it('床のワープへは直接歩く経路を返す', () => {
    expect(routeToWarp(room, { x: 0, y: 0 }, 'town')).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ])
  })
  it('壁の扉へは隣のマスまで歩き、最後の1歩に扉そのものを付ける', () => {
    const route = routeToWarp(walled, { x: 0, y: 0 }, 'town')
    expect(route?.at(-1)).toEqual({ x: 2, y: 0 })
    expect(route?.at(-2)).toEqual({ x: 1, y: 0 })
    expect(route).toHaveLength(2)
  })
  it('扉の隣に立っていれば経路は扉の1歩だけ', () => {
    expect(routeToWarp(walled, { x: 2, y: 1 }, 'town')).toEqual([{ x: 2, y: 0 }])
  })
  it('通じる扉が無いワールド名なら null', () => {
    expect(routeToWarp(room, { x: 0, y: 0 }, 'nowhere')).toBeNull()
    expect(routeToWarp(town, { x: 0, y: 0 }, 'room')).toBeNull()
  })
  it('同じ長さの経路が並ぶ時は、先に見つかった扉の経路を残す(同点では更新しない)', () => {
    // 中央から見て左右対称に扉が並ぶ部屋。どちらへの経路も長さ1で同点になる
    const twoDoors: World = {
      id: 'two-doors',
      kind: 'interior',
      width: 3,
      height: 1,
      start: { x: 1, y: 0 },
      startFacing: 'down',
      tiles: [['mat', 'floor', 'mat']],
      structures: [],
      spots: [],
      warps: [
        {
          id: 'left',
          cell: { x: 0, y: 0 },
          target: { worldId: 'town', cell: { x: 9, y: 7 }, facing: 'down' },
        },
        {
          id: 'right',
          cell: { x: 2, y: 0 },
          target: { worldId: 'town', cell: { x: 9, y: 7 }, facing: 'down' },
        },
      ],
    }
    expect(routeToWarp(twoDoors, { x: 1, y: 0 }, 'town')).toEqual([{ x: 0, y: 0 }])
  })
  // 1 行 4 マスの廊下の両端に、同じ行き先の床のワープを置く
  const corridor: World = {
    ...room,
    width: 4,
    height: 1,
    tiles: [['mat', 'floor', 'floor', 'mat']],
    warps: [
      {
        id: 'far',
        cell: { x: 0, y: 0 },
        target: { worldId: 'town', cell: { x: 9, y: 7 }, facing: 'down' },
      },
      {
        id: 'near',
        cell: { x: 3, y: 0 },
        target: { worldId: 'town', cell: { x: 9, y: 7 }, facing: 'down' },
      },
    ],
  }
  it('後に並ぶ扉の方が近ければ、そちらの経路に替える', () => {
    expect(routeToWarp(corridor, { x: 2, y: 0 }, 'town')).toEqual([{ x: 3, y: 0 }])
  })
  it('後に並ぶ扉へ届かなくても、先に見つけた扉の経路を残す', () => {
    // 廊下を 1 マス延ばして右端のワープを (4,0) へ移し、手前の (3,0) を水にして届かなくする
    const blocked: World = {
      ...corridor,
      width: 5,
      tiles: [['mat', 'floor', 'floor', 'water', 'mat']],
      warps: [corridor.warps[0], { ...corridor.warps[1], cell: { x: 4, y: 0 } }],
    }
    expect(routeToWarp(blocked, { x: 2, y: 0 }, 'town')).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ])
  })
})
