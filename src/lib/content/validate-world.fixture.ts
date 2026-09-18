// 村ワールド検査のテストが共有する最小ワールド。3つのテストから読むのでここに置く
import type { World, WorldSet } from '@content/types/world'

// 家1軒と会話地点1つの最小の屋外ワールド。家は area 全体が通行不可なので、地点(2,2)は area の外に置く
export const tinyTown = (over: Partial<World> = {}): World => ({
  id: 'town',
  kind: 'exterior',
  width: 5,
  height: 4,
  start: { x: 0, y: 3 },
  startFacing: 'up',
  tiles: [
    ['grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass'],
    ['path', 'path', 'path', 'path', 'path'],
  ],
  structures: [
    {
      id: 'h1',
      kind: 'house',
      roof: 'red',
      area: { x: 1, y: 0, w: 3, h: 2 },
      solid: { x: 1, y: 1, w: 3, h: 1 },
      doorX: 2,
    },
  ],
  spots: [{ id: 's1', structureId: 'h1', cell: { x: 2, y: 2 }, facing: 'up', order: 1 }],
  warps: [],
  ...over,
})

// 机 1 つと地点 1 つの最小の屋内ワールド。出口マット(3,2)から town へ出る
export const tinyRoom = (over: Partial<World> = {}): World => ({
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
  structures: [{ id: 'desk', kind: 'desk', cell: { x: 0, y: 0 } }],
  spots: [{ id: 'home', structureId: 'desk', cell: { x: 3, y: 0 }, facing: 'left', order: 1 }],
  warps: [
    {
      id: 'exit',
      cell: { x: 3, y: 2 },
      target: { worldId: 'town', cell: { x: 0, y: 3 }, facing: 'down' },
    },
  ],
  ...over,
})

// 屋外 1 つだけの村
export const townSet = (over: Partial<World> = {}): WorldSet => ({
  id: 'one',
  startWorldId: 'town',
  worlds: { town: tinyTown(over) },
})

// 部屋(order 1)+ 町(order 2)の 2 ワールドの村
export const pairSet = (over: { room?: Partial<World>; town?: Partial<World> } = {}): WorldSet => ({
  id: 'pair',
  startWorldId: 'room',
  worlds: {
    room: tinyRoom(over.room),
    town: tinyTown({
      spots: [{ id: 's1', structureId: 'h1', cell: { x: 2, y: 2 }, facing: 'up', order: 2 }],
      ...over.town,
    }),
  },
})
