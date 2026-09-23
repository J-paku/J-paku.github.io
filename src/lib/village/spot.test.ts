// 会話地点 spotAt・allSpots・nextSpot・spotWorldId・talkAnchor のテスト
import { vi } from 'vitest'
import type { Spot, World, WorldSet } from '@content/types/world'
import { spotAt, allSpots, nextSpot, spotWorldId, talkAnchor, type TalkAnchor } from './spot'

// server-only は Next.js のビルド境界専用ガードで、vitest(node 環境)では無条件に例外を投げる。
// テストでは中身を持たない mock に差し替え、読み込み専用の @/lib/content/read を素通しにする
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

// 実ワールドセットの town を取得。無ければテスト側で即座に落とし、以降の型を World に保つ
const realWorldSet = readWorldSet()
const realTownOrUndefined = realWorldSet.worlds.town
if (realTownOrUndefined === undefined) throw new Error('worldSet に town が無い')
const realTown: World = realTownOrUndefined

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

// 2×2 のテーブルを 1 つ置いた野原。spotAt と talkAnchor のテストで共用する
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

// 物の占有矩形を囲む通路から、全方向で会話できる
describe('spotAt (全方向)', () => {
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
  it('2×2 の構造物(経歴碑を模した物)は、上下左右どのマスからでも話しかけられる', () => {
    const monumentField: World = {
      ...field,
      structures: [{ id: 'mon', kind: 'monument', cell: { x: 3, y: 3 } }],
      spots: [{ id: 'monument', structureId: 'mon', cell: { x: 3, y: 5 }, facing: 'up' }],
    }
    expect(spotAt(monumentField, { x: 3, y: 5 })?.id).toBe('monument')
    expect(spotAt(monumentField, { x: 4, y: 5 })?.id).toBe('monument')
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

// 明示された立ち位置(spot.cell の完全一致)の枝。構造物への隣接判定とは別の入口で、
// 隣接判定が同じマスを拾える時はそちらが優先されていないことまで見る
describe('spotAt (明示された立ち位置)', () => {
  it('構造物に隣接しないマスでも、spot.cell と一致すれば拾う', () => {
    const lone: World = {
      ...field,
      // 構造物を持たない地点。テーブル (3,3) からも離れていて、隣接判定では絶対に拾えない
      spots: [{ id: 'lone', cell: { x: 8, y: 6 }, facing: 'up' }],
    }
    expect(spotAt(lone, { x: 8, y: 6 })?.id).toBe('lone')
    expect(spotAt(lone, { x: 8, y: 5 })).toBeNull()
  })
  it('隣接判定と重なるマスでは、明示された立ち位置の地点を優先する', () => {
    const overlap: World = {
      ...field,
      // (2,3) はテーブル(3,3 から 2×2)の左隣。隣接判定だけなら 'table' を拾うマス
      spots: [...field.spots, { id: 'sign', cell: { x: 2, y: 3 }, facing: 'right' }],
    }
    expect(spotAt(overlap, { x: 2, y: 3 })?.id).toBe('sign')
    // 重なっていない辺は今まで通りテーブルの地点を拾う
    expect(spotAt(overlap, { x: 5, y: 4 })?.id).toBe('table')
  })
})

// 到着範囲の横の境界。実際の町の出口は範囲の左右が木で、通行判定に隠れて境界式が効いていない。
// 左右とも草(通行可)の合成ワールドで、範囲の判定だけで外れることを見る
describe('spotAt (到着範囲の境界)', () => {
  const gate: World = {
    ...field,
    structures: [],
    spots: [
      { id: 'gate', cell: { x: 4, y: 0 }, facing: 'up', arrivalArea: { x: 4, y: 0, w: 2, h: 1 } },
    ],
  }
  it('範囲の 2 マスはどちらでも開く', () => {
    expect(spotAt(gate, { x: 4, y: 0 })?.id).toBe('gate')
    expect(spotAt(gate, { x: 5, y: 0 })?.id).toBe('gate')
  })
  it('範囲の左右 1 マス外は、通行可でも開かない', () => {
    expect(spotAt(gate, { x: 3, y: 0 })).toBeNull()
    expect(spotAt(gate, { x: 6, y: 0 })).toBeNull()
  })
})

// order の無い地点(経歴碑のようにコース外の地点)を加えても、既存の set 自体はそのまま使う
describe('order の無い地点', () => {
  const monumentSpot: Spot = {
    id: 'monument',
    structureId: 'f',
    cell: { x: 2, y: 0 },
    facing: 'up',
  }
  const setWithMonument: WorldSet = {
    ...set,
    worlds: { ...set.worlds, town: { ...town, spots: [...town.spots, monumentSpot] } },
  }
  it('allSpots はコース地点だけを order 順で返し、order の無い地点は含まない', () => {
    expect(allSpots(setWithMonument).map(s => s.id)).toEqual(['home', 'second', 'third'])
  })
  it('order の無い地点の次は null', () => {
    expect(nextSpot(setWithMonument, monumentSpot)).toBeNull()
  })
  it('order の無い地点でも spotWorldId は解決できる', () => {
    expect(spotWorldId(setWithMonument, 'monument')).toBe('town')
  })
})

// 実際の worldSet(content/world.ts)の町に経歴碑が入った状態のテスト
describe('spotAt (実際の worldSet — 経歴碑)', () => {
  it('経歴碑(2×2)の真下の 2 マスのどちらからでも話しかけられる', () => {
    expect(spotAt(realTown, { x: 16, y: 4 })?.id).toBe('monument')
    expect(spotAt(realTown, { x: 17, y: 4 })?.id).toBe('monument')
  })
  it('既存の地点は経歴碑を加えても変わらず判定できる', () => {
    expect(spotAt(realTown, { x: 6, y: 6 })?.id).toBe('meishi')
    expect(spotAt(realTown, { x: 8, y: 14 })?.id).toBe('robot')
    expect(spotAt(realTown, { x: 24, y: 15 })?.id).toBe('mailbox')
  })
})

describe('北の出口', () => {
  it('道の突き当たりは左右どちらの列でも到着地点になり、手前や木の壁では開かない', () => {
    expect(spotAt(realTown, { x: 14, y: 0 })?.id).toBe('journey')
    expect(spotAt(realTown, { x: 15, y: 0 })?.id).toBe('journey')
    // 1マス手前(道は続く)と、道の左右の木
    expect(spotAt(realTown, { x: 14, y: 1 })).toBeNull()
    expect(spotAt(realTown, { x: 13, y: 0 })).toBeNull()
    expect(spotAt(realTown, { x: 16, y: 0 })).toBeNull()
    expect(allSpots(realWorldSet)).toHaveLength(5)
  })

  it('道だけが外周を抜け、左右は木の壁のまま残る', () => {
    expect(realTown.tiles[0][14]).toBe('path')
    expect(realTown.tiles[0][15]).toBe('path')
    expect(realTown.tiles[0][13]).toBe('tree')
    expect(realTown.tiles[0][16]).toBe('tree')
  })

  // 外周のマスは上に吹き出しの置き場が無い。上へ出すと枠の外で切れるので下へ出す
  it('建物を持たない出口の吹き出しは、範囲の中央から下へ出す', () => {
    const journey = realTown.spots.find(spot => spot.id === 'journey')
    if (journey === undefined) throw new Error('journey が無い')

    expect(talkAnchor(realTown, journey, journey.cell)).toEqual({ x: 15, y: 1, place: 'below' })
  })
})

// 吹き出しを付ける位置。主人公が実際に立つマスで決める(地点の正規の会話マス spot.cell ではない)。
// 主人公が物より上に立つ時だけ主人公の頭上、下・横に立つ時は物の中央・上辺
describe('talkAnchor', () => {
  it('物より上に立つと、物ではなく主人公の頭上(半マス上)に出す', () => {
    const spot = field.spots[0]
    expect(talkAnchor(field, spot, spot.cell)).toEqual({ x: 4.5, y: 1.5, place: 'above' })
  })
  it('上を向く地点は、テーブル(2×2)の中央・上辺に出す', () => {
    const spot: Spot = { id: 'below', structureId: 't', cell: { x: 4, y: 5 }, facing: 'up' }
    expect(talkAnchor(field, spot, spot.cell)).toEqual({ x: 4, y: 3, place: 'above' })
  })
  it('横を向く地点でも、位置は同じ物の中央・上辺で変わらない', () => {
    const spot: Spot = { id: 'beside', structureId: 't', cell: { x: 5, y: 4 }, facing: 'left' }
    expect(talkAnchor(field, spot, spot.cell)).toEqual({ x: 4, y: 3, place: 'above' })
  })
  it('正規の会話マスが物の上でも、物の下・横に立って話しかけたら物の中央・上辺に出す', () => {
    // field の地点は (4,2) で下を向く。spotAt は物を囲む全方向のマスでこの地点を拾う
    const spot = field.spots[0]
    expect(talkAnchor(field, spot, { x: 4, y: 5 })).toEqual({ x: 4, y: 3, place: 'above' })
    expect(talkAnchor(field, spot, { x: 2, y: 3 })).toEqual({ x: 4, y: 3, place: 'above' })
  })
  it('正規の会話マスが物の下でも、物の上に立って話しかけたら主人公の頭上に出す', () => {
    const spot: Spot = { id: 'below', structureId: 't', cell: { x: 4, y: 5 }, facing: 'up' }
    expect(talkAnchor(field, spot, { x: 3, y: 2 })).toEqual({ x: 3.5, y: 1.5, place: 'above' })
  })
  it('机(3×2)は左上から 1.5 マス右が中央', () => {
    const spot = room.spots[0]
    expect(talkAnchor(room, spot, spot.cell)).toEqual({ x: 1.5, y: 0, place: 'above' })
  })
  it('建物は入口の列(幅 2)の中央・最下段の壁の上辺に出す', () => {
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
    }
    const spot: Spot = { id: 'house', structureId: 'h', cell: { x: 4, y: 4 }, facing: 'up' }
    expect(talkAnchor(house, spot, spot.cell)).toEqual({ x: 5, y: 3, place: 'above' })
  })
  it('物が見つからない地点は、向いている 1 マスの中央・上辺に出す', () => {
    const spot: Spot = { id: 'ghost', structureId: 'missing', cell: { x: 4, y: 2 }, facing: 'up' }
    expect(talkAnchor(field, spot, spot.cell)).toEqual({ x: 4.5, y: 1, place: 'above' })
  })
  it('物が見つからなくても、向いている 1 マスより上に立つ(下を向く)なら主人公の頭上のまま', () => {
    const spot: Spot = { id: 'ghost', structureId: 'missing', cell: { x: 4, y: 2 }, facing: 'down' }
    expect(talkAnchor(field, spot, spot.cell)).toEqual({ x: 4.5, y: 1.5, place: 'above' })
  })
})

// 実際の町のポスト (24,14)。正規の会話マスは上の (24,13) だが、spotAt は上下左右どこからでも拾う。
// 下から話しかけた時に正規の会話マスの頭上へ付くと、主人公より 2 マス余り上へ浮き、
// 縦持ちのスマートフォンでは枠の上で切れていた
describe('talkAnchor (実際の worldSet — ポスト)', () => {
  it.each([
    { from: '上(正規の会話マス)', player: { x: 24, y: 13 }, anchor: { x: 24.5, y: 12.5 } },
    { from: '下', player: { x: 24, y: 15 }, anchor: { x: 24.5, y: 14 } },
    { from: '横', player: { x: 23, y: 14 }, anchor: { x: 24.5, y: 14 } },
  ])('$from から話しかける', ({ player, anchor }) => {
    const mailbox = realTown.spots.find(spot => spot.id === 'mailbox')
    if (mailbox === undefined) throw new Error('mailbox が無い')
    // 実際に立てて、この地点を拾うマスであること
    expect(spotAt(realTown, player)?.id).toBe('mailbox')
    expect(talkAnchor(realTown, mailbox, player)).toEqual({ ...anchor, place: 'above' })
  })
})

// 正規の会話マス(spot.cell)に立つ時の位置は、主人公のマスを受け取る前の talkAnchor(world, spot) と同じ。
// 表の値は変更前の実装が返していたもの。地点を足したら、ここへも 1 行足して位置を確かめる
const CANONICAL_ANCHORS: Record<string, TalkAnchor> = {
  'room/home': { x: 4.5, y: 2, place: 'above' },
  'room/clock': { x: 7.5, y: 2, place: 'above' },
  'town/meishi': { x: 6.5, y: 5, place: 'above' },
  'town/lab': { x: 24, y: 5, place: 'above' },
  'town/robot': { x: 8.5, y: 13.5, place: 'above' },
  'town/mailbox': { x: 24.5, y: 12.5, place: 'above' },
  'town/monument': { x: 17, y: 2, place: 'above' },
  'town/journey': { x: 15, y: 1, place: 'below' },
}

describe('talkAnchor (実際の worldSet — 正規の会話マス)', () => {
  const realSpots = Object.entries(realWorldSet.worlds).flatMap(([worldId, world]) =>
    world.spots.map(spot => ({ key: `${worldId}/${spot.id}`, world, spot }))
  )
  it('表は全ワールドの地点を過不足なく並べている', () => {
    expect(new Set(realSpots.map(ref => ref.key))).toEqual(new Set(Object.keys(CANONICAL_ANCHORS)))
  })
  it.each(realSpots)('$key', ({ key, world, spot }) => {
    expect(talkAnchor(world, spot, spot.cell)).toEqual(CANONICAL_ANCHORS[key])
  })
})
