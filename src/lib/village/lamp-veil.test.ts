// 街灯との重なり判定 lampVeilAt のテスト
import type { World } from '@content/types/world'
import { lampVeilAt } from './lamp-veil'

// 街灯 2 本と、街灯でない構造物(焚き火・家)を置いた草地。
// 西の街灯は (2,2) が灯・(2,3) が柱、東の街灯は (6,2) と (6,3)
const town: World = {
  id: 'town',
  kind: 'exterior',
  width: 8,
  height: 8,
  start: { x: 0, y: 7 },
  startFacing: 'up',
  tiles: Array.from({ length: 8 }, () => Array(8).fill('grass')),
  structures: [
    { id: 'lamp-west', kind: 'lamp', cell: { x: 2, y: 2 } },
    { id: 'lamp-east', kind: 'lamp', cell: { x: 6, y: 2 } },
    { id: 'cf', kind: 'campfire', cell: { x: 0, y: 6 } },
    {
      id: 'h',
      kind: 'house',
      roof: 'red',
      area: { x: 3, y: 5, w: 2, h: 2 },
      solid: { x: 3, y: 6, w: 2, h: 1 },
      doorX: 3,
    },
  ],
  spots: [],
  warps: [],
}

// 西の街灯が返すべき中身。facadeCells と同じ並び(上の灯 → 下の柱)
const westVeil = {
  id: 'lamp-west',
  cells: [
    { cell: { x: 2, y: 2 }, key: 'lamp-t' },
    { cell: { x: 2, y: 3 }, key: 'lamp-b' },
  ],
}

describe('lampVeilAt', () => {
  it('柱のマス(lamp-b)も絵のマスなので、その街灯の id と上下 2 マスが返る', () => {
    expect(lampVeilAt(town, { x: 2, y: 3 })).toEqual(westVeil)
  })
  it('主人公が立てる灯のマス(lamp-t = 笠の裏)でも同じ結果が返る', () => {
    expect(lampVeilAt(town, { x: 2, y: 2 })).toEqual(westVeil)
  })
  it('柱のすぐ下の隣(街灯の真南)は重なりに数えず null', () => {
    // ここでは主人公が街灯より手前に描かれる。頭が半マス上へ出ることを理由に重ねない
    expect(lampVeilAt(town, { x: 2, y: 4 })).toBeNull()
  })
  it('街灯の真上・左右の隣も null', () => {
    expect(lampVeilAt(town, { x: 2, y: 1 })).toBeNull()
    expect(lampVeilAt(town, { x: 1, y: 3 })).toBeNull()
    expect(lampVeilAt(town, { x: 3, y: 3 })).toBeNull()
  })
  it('街灯でない構造物のマス(焚き火・家)では null', () => {
    expect(lampVeilAt(town, { x: 0, y: 6 })).toBeNull()
    expect(lampVeilAt(town, { x: 3, y: 5 })).toBeNull()
    expect(lampVeilAt(town, { x: 3, y: 6 })).toBeNull()
  })
  it('何も無い草地では null', () => {
    expect(lampVeilAt(town, { x: 7, y: 7 })).toBeNull()
  })
  it('街灯が複数あっても、絵の重なった方の 1 本だけが返る', () => {
    expect(lampVeilAt(town, { x: 6, y: 3 })).toEqual({
      id: 'lamp-east',
      cells: [
        { cell: { x: 6, y: 2 }, key: 'lamp-t' },
        { cell: { x: 6, y: 3 }, key: 'lamp-b' },
      ],
    })
  })
  it('街灯が 1 本も無いワールドでは null', () => {
    expect(lampVeilAt({ ...town, structures: [] }, { x: 2, y: 3 })).toBeNull()
  })
})
