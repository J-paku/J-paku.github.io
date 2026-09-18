// 村 = 屋内(自分の部屋)+ 屋外(町)の 2 ワールド。座標は左上原点の整数マス、tiles[y][x]。
// 構造物は tiles の上に重ねて描くので、その下の tiles は地面(grass / floor)にしておく。
// 部屋の下端のマット(2 マス)に乗ると町の自宅前へ、町の自宅の扉は部屋のマット手前へと双方向に行き来できる。自宅は町の中央
import type { Tile, World, WorldSet } from '@content/types/world'

const N = 'wall' as const
const L = 'floor' as const
const M = 'mat' as const

// 自分の部屋(10×8)。上 2 行は壁。下端 (4,7)(5,7) のマットが出口。PC 机の前 (4,4) が「自宅」地点
export const room: World = {
  id: 'room',
  kind: 'interior',
  width: 10,
  height: 8,
  start: { x: 4, y: 4 },
  startFacing: 'up',
  tiles: [
    [N, N, N, N, N, N, N, N, N, N],
    [N, N, N, N, N, N, N, N, N, N],
    [L, L, L, L, L, L, L, L, L, L],
    [L, L, L, L, L, L, L, L, L, L],
    [L, L, L, L, L, L, L, L, L, L],
    [L, L, L, L, L, L, L, L, L, L],
    [L, L, L, L, L, L, L, L, L, L],
    [L, L, L, L, M, M, L, L, L, L],
  ],
  structures: [
    { id: 'desk', kind: 'desk', cell: { x: 3, y: 2 } },
    { id: 'bed', kind: 'bed', cell: { x: 0, y: 5 } },
    { id: 'table', kind: 'table', cell: { x: 6, y: 5 } },
  ],
  spots: [{ id: 'home', structureId: 'desk', cell: { x: 4, y: 4 }, facing: 'up', order: 1 }],
  // マットは 2 マスともワープ。どちらに乗っても町の自宅前へ出る
  warps: [
    {
      id: 'exit-l',
      cell: { x: 4, y: 7 },
      target: { worldId: 'town', cell: { x: 14, y: 12 }, facing: 'down' },
    },
    {
      id: 'exit-r',
      cell: { x: 5, y: 7 },
      target: { worldId: 'town', cell: { x: 14, y: 12 }, facing: 'down' },
    },
  ],
}

// 町の地面は1文字=2×2マスのブロックで書く。15×10ブロックがそのまま30×20マスになる
const T = 'T' as const // 木1本(tree-tl/tr/bl/br の4分割)
const G = 'G' as const // 草4マス
const g = 'g' as const // 草の市松(grass と grass-alt を交互に)
const P = 'P' as const // 道4マス
const W = 'W' as const // 水4マス
const S = 'S' as const // 広場4マス
const F = 'F' as const // 花(対角2マスだけ flower)
type Block = typeof T | typeof G | typeof g | typeof P | typeof W | typeof S | typeof F

// ブロック 1 つ分の 2×2パターン。並びは [左上, 右上, 左下, 右下]
const BLOCK_TILES: Record<Block, readonly [Tile, Tile, Tile, Tile]> = {
  T: ['tree-tl', 'tree-tr', 'tree-bl', 'tree-br'],
  G: ['grass', 'grass', 'grass', 'grass'],
  g: ['grass', 'grass-alt', 'grass-alt', 'grass'],
  P: ['path', 'path', 'path', 'path'],
  W: ['water', 'water', 'water', 'water'],
  S: ['plaza', 'plaza', 'plaza', 'plaza'],
  F: ['flower', 'grass', 'grass', 'flower'],
}

// ブロック地図を 1 行につき 2 行のマスへ展開して tiles[y][x] を作る
const expandBlocks = (rows: readonly (readonly Block[])[]): Tile[][] =>
  rows.flatMap(row => [
    row.flatMap(b => [BLOCK_TILES[b][0], BLOCK_TILES[b][1]]),
    row.flatMap(b => [BLOCK_TILES[b][2], BLOCK_TILES[b][3]]),
  ])

// 町のブロック地図(15×10)。外周1ブロック=2マス分が木の壁で四辺を閉じる
const TOWN_BLOCKS: readonly (readonly Block[])[] = [
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
  [T, G, G, G, G, g, G, F, G, G, G, G, G, G, T],
  [T, G, G, G, G, G, g, G, G, G, G, G, G, G, T],
  [T, G, P, P, P, P, P, P, P, P, P, P, P, P, T],
  [T, g, G, F, G, P, G, G, G, P, G, G, g, G, T],
  [T, G, G, G, G, P, G, G, G, P, G, g, G, G, T],
  [T, G, P, P, P, P, P, P, P, P, P, P, P, P, T],
  [T, W, W, G, G, g, G, G, G, G, G, S, S, S, T],
  [T, W, W, G, F, G, G, G, G, G, G, S, S, S, T],
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
]

// 町(30×20)。横道は y6-7 と y12-13、縦道は x10-11 と x18-19。
// 池は x2-5/y14-17、広場は x22-27/y14-17。自宅前(14,12)から各地点まで16歩以内
export const town: World = {
  id: 'town',
  kind: 'exterior',
  width: 30,
  height: 20,
  start: { x: 14, y: 12 },
  startFacing: 'down',
  tiles: expandBlocks(TOWN_BLOCKS),
  structures: [
    {
      id: 'home',
      kind: 'house',
      roof: 'red',
      area: { x: 12, y: 8, w: 6, h: 4 },
      solid: { x: 12, y: 10, w: 6, h: 2 },
      doorX: 14,
      doorWidth: 2,
    },
    {
      id: 'meishi',
      kind: 'house',
      roof: 'red',
      area: { x: 4, y: 2, w: 6, h: 4 },
      solid: { x: 4, y: 4, w: 6, h: 2 },
      doorX: 6,
      doorWidth: 2,
    },
    {
      id: 'lab',
      kind: 'house',
      roof: 'blue',
      area: { x: 20, y: 2, w: 8, h: 4 },
      solid: { x: 20, y: 4, w: 8, h: 2 },
      doorX: 23,
      doorWidth: 2,
    },
    { id: 'bench', kind: 'bench', cell: { x: 6, y: 15 }, scale: 2 },
    { id: 'fountain', kind: 'fountain', cell: { x: 24, y: 16 }, scale: 2 },
  ],
  spots: [
    { id: 'meishi', structureId: 'meishi', cell: { x: 6, y: 6 }, facing: 'up', order: 2 },
    { id: 'lab', structureId: 'lab', cell: { x: 23, y: 6 }, facing: 'up', order: 3 },
    { id: 'bench', structureId: 'bench', cell: { x: 8, y: 14 }, facing: 'down', order: 4 },
    { id: 'plaza', structureId: 'fountain', cell: { x: 24, y: 15 }, facing: 'down', order: 5 },
  ],
  warps: [
    {
      id: 'home',
      cell: { x: 14, y: 11 },
      target: { worldId: 'room', cell: { x: 4, y: 6 }, facing: 'up' },
    },
    {
      id: 'home-right',
      cell: { x: 15, y: 11 },
      target: { worldId: 'room', cell: { x: 5, y: 6 }, facing: 'up' },
    },
  ],
}

export const worldSet: WorldSet = {
  id: 'town-s2',
  startWorldId: 'room',
  worlds: { room, town },
}
