// 村 = 屋内(自分の部屋)+ 屋外(町)の 2 ワールド。座標は左上原点の整数マス、tiles[y][x]。
// 構造物は tiles の上に重ねて描くので、その下の tiles は地面(grass / floor)にしておく。
// 部屋の下端のマット(1 マス)に乗ると町の自宅前へ、町の自宅の扉は部屋のマット手前へと双方向に行き来できる。自宅は町の中央
import type { Tile, World, WorldSet } from '@content/types/world'

const N = 'wall' as const
const L = 'floor' as const
const M = 'mat' as const

// 自分の部屋(10×8)。上 2 行は壁。下端 (4,7) のマットが出口。PC 机の前 (4,4) が「自宅」地点。
// 卓上時計(clock)は小机ごと 1 マス (7,2)、話しかけ位置は手前の (7,3) — コース外で、会話窓ではなく時間設定の窓が開く
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
    [L, L, L, L, M, L, L, L, L, L],
  ],
  structures: [
    { id: 'desk', kind: 'desk', cell: { x: 3, y: 2 } },
    { id: 'bed', kind: 'bed', cell: { x: 0, y: 5 } },
    { id: 'table', kind: 'table', cell: { x: 6, y: 5 } },
    { id: 'clock', kind: 'clock', cell: { x: 7, y: 2 } },
  ],
  spots: [
    { id: 'home', structureId: 'desk', cell: { x: 4, y: 4 }, facing: 'up', order: 1 },
    // コース外(order 無し)。action があるので会話窓ではなく時間設定の窓が開く
    { id: 'clock', structureId: 'clock', cell: { x: 7, y: 3 }, facing: 'up', action: 'clock' },
  ],
  // マットは 1 マス。乗ると町の自宅前へ出る
  warps: [
    {
      id: 'exit',
      cell: { x: 4, y: 7 },
      target: { worldId: 'town', cell: { x: 14, y: 12 }, facing: 'down' },
    },
  ],
}

// 町の地面は1文字=2×2マスのブロックで書く。15×10ブロックがそのまま30×20マスになる
const T = 'T' as const // 木の壁(1マス=1本の木を4個並べる)
const G = 'G' as const // 草4マス
const g = 'g' as const // 草の市松(grass と grass-alt を交互に)
const P = 'P' as const // 道4マス
const W = 'W' as const // 水4マス
const S = 'S' as const // 広場4マス
const F = 'F' as const // 花(対角2マスだけ flower)
type Block = typeof T | typeof G | typeof g | typeof P | typeof W | typeof S | typeof F

// ブロック 1 つ分の 2×2パターン。並びは [左上, 右上, 左下, 右下]
const BLOCK_TILES: Record<Block, readonly [Tile, Tile, Tile, Tile]> = {
  T: ['tree', 'tree', 'tree', 'tree'],
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

// 町のブロック地図(15×10)。外周1ブロック=2マス分が木の壁で四辺を閉じるが、
// 北の中央だけは 2マス幅の道が外周を抜けて町の外へ続く
const TOWN_BLOCKS: readonly (readonly Block[])[] = [
  [T, T, T, T, T, T, T, P, T, T, T, T, T, T, T],
  [T, G, G, G, G, g, G, P, G, G, G, G, G, G, T],
  [T, G, G, G, G, G, g, P, G, G, G, G, G, G, T],
  [T, G, P, P, P, P, P, P, P, P, P, P, P, P, T],
  [T, g, G, F, G, P, G, G, G, P, G, G, g, G, T],
  [T, G, G, G, G, P, G, G, G, P, G, g, G, G, T],
  [T, G, P, P, P, P, P, P, P, P, P, P, P, P, T],
  [T, W, W, G, G, g, G, G, G, G, G, S, S, S, T],
  [T, W, W, G, F, G, G, G, G, G, G, S, S, S, T],
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
]

// 町(30×20)。横道は y6-7 と y12-13、縦道は x10-11 と x18-19。
// 池は x2-5/y14-17、広場は x22-27/y14-17。自宅前(14,12)から各地点まで16歩以内。
// 北の道は x14-15/y0-5 で、外周を抜けて町の外へ出る。道の左右 x12-13・x16-17 の y0-1 は木。
// 経歴碑はその木の手前 (16,2)、話しかけ位置は道に面した (16,4) — コース外
// 次の旅(journey)は道の突き当たり x14-15/y0 に着くと開く。外周のマスなので吹き出しの置き場が
// 上に無く、talkAnchor が足元から下へ出す(建物を持たない地点の扱い。spot.ts 参照)
// 郵便ポスト(mailbox)は広場の北端 (24,14)、話しかけ位置は道に面した (24,13)
// 焚き火(campfire)はロボット (8,15) の東隣 (9,15) の草地に 1 マス、通行不可。
// ロボットの話しかけ位置 (8,14) とその周りの道は塞がない
// 街灯(lamp)は西 (9,8)・東 (20,8)・広場際 (20,14)の3つ、いずれも上下2マスが通行不可で草地に立つ
// 家は屋根 2 行 + 壁 2 行(上段が窓行、下段が扉行)。3 軒とも同じ高さ
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
      area: { x: 13, y: 8, w: 4, h: 4 },
      solid: { x: 13, y: 10, w: 4, h: 2 },
      doorX: 14,
    },
    {
      id: 'meishi',
      kind: 'house',
      roof: 'red',
      area: { x: 4, y: 2, w: 4, h: 4 },
      solid: { x: 4, y: 4, w: 4, h: 2 },
      doorX: 6,
    },
    {
      id: 'lab',
      kind: 'house',
      roof: 'blue',
      area: { x: 21, y: 2, w: 5, h: 4 },
      solid: { x: 21, y: 4, w: 5, h: 2 },
      doorX: 23,
      doorWidth: 2,
    },
    { id: 'robot', kind: 'robot', cell: { x: 8, y: 15 } },
    { id: 'campfire', kind: 'campfire', cell: { x: 9, y: 15 } },
    { id: 'mailbox', kind: 'mailbox', cell: { x: 24, y: 14 } },
    { id: 'monument', kind: 'monument', cell: { x: 16, y: 2 } },
    { id: 'lamp-west', kind: 'lamp', cell: { x: 9, y: 8 } },
    { id: 'lamp-east', kind: 'lamp', cell: { x: 20, y: 8 } },
    { id: 'lamp-plaza', kind: 'lamp', cell: { x: 20, y: 14 } },
  ],
  spots: [
    { id: 'meishi', structureId: 'meishi', cell: { x: 6, y: 6 }, facing: 'up', order: 2 },
    { id: 'lab', structureId: 'lab', cell: { x: 23, y: 6 }, facing: 'up', order: 3 },
    { id: 'robot', structureId: 'robot', cell: { x: 8, y: 14 }, facing: 'down', order: 4 },
    { id: 'mailbox', structureId: 'mailbox', cell: { x: 24, y: 13 }, facing: 'down', order: 5 },
    // コース外(order 無し)。話しかけ・地図表示・地図からの移動はできるが、次の地点・訪問数・完走判定には数えない
    { id: 'monument', structureId: 'monument', cell: { x: 16, y: 4 }, facing: 'up' },
    {
      id: 'journey',
      cell: { x: 14, y: 0 },
      facing: 'up',
      arrivalArea: { x: 14, y: 0, w: 2, h: 1 },
    },
  ],
  warps: [
    {
      id: 'home',
      cell: { x: 14, y: 11 },
      target: { worldId: 'room', cell: { x: 4, y: 6 }, facing: 'up' },
    },
  ],
}

export const worldSet: WorldSet = {
  id: 'town-s2',
  startWorldId: 'room',
  worlds: { room, town },
}
