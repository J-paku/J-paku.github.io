// 重ね表示を閉じた後の道中を決める純粋関数(plan-travel)のテスト。
// 小さな作りのワールドで、分かれ目ごとの境を具体的な経路・案内の値で固める
import { describe, expect, it, vi } from 'vitest'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import { planNext, type TravelInput, type TravelPlan } from './plan-travel'

// server-onlyはNext.jsのビルド境界専用ガードで、vitestでは無条件に例外を投げる。
// テストでは中身を持たないmockに差し替え、読み込み専用の@/lib/content/readを素通しにする
vi.mock('server-only', () => ({}))

import { readVillageText, readWorldSet } from '@/lib/content/read'

const worldSet = readWorldSet()
const text = readVillageText('ja')

// worldKeyのワールドのcellに立っている所から道中を決める材料
const inputAt = (
  worldKey: string,
  cell: Cell,
  set: WorldSet = worldSet,
  villageText: VillageText = text
): TravelInput => ({
  worldSet: set,
  text: villageText,
  world: set.worlds[worldKey],
  worldKey,
  cell,
})

// 結果がkindの形であることを確かめ、その形として返す
const expectKind = <K extends TravelPlan['kind']>(
  plan: TravelPlan,
  kind: K
): Extract<TravelPlan, { kind: K }> => {
  expect(plan.kind).toBe(kind)
  return plan as Extract<TravelPlan, { kind: K }>
}

const NONE = { kind: 'none' }

const baseStop = Object.values(text.stops)[0]

// 水の列(x2)で東西に分かれた5×3のワールドyardと、扉の無い2×1のbarn。yardの扉は西の下の隅(0,2)の床で、barnへ通じる。
// コースはgate(0,0)→well(1,1)→pier(4,1、東の岸)→loft(barn)の順で、bench(1,2)はコース外。
// 東の岸からは西の地点へも扉へも歩いて行けない
const gate: Spot = { id: 'gate', cell: { x: 0, y: 0 }, facing: 'up', order: 1 }
const well: Spot = { id: 'well', cell: { x: 1, y: 1 }, facing: 'up', order: 2 }
const pier: Spot = { id: 'pier', cell: { x: 4, y: 1 }, facing: 'up', order: 3 }
const bench: Spot = { id: 'bench', cell: { x: 1, y: 2 }, facing: 'up' }
const loft: Spot = { id: 'loft', cell: { x: 1, y: 0 }, facing: 'up', order: 4 }
const yard: World = {
  id: 'yard',
  kind: 'exterior',
  width: 5,
  height: 3,
  start: gate.cell,
  startFacing: 'down',
  tiles: [
    ['grass', 'grass', 'water', 'grass', 'grass'],
    ['grass', 'grass', 'water', 'grass', 'grass'],
    ['grass', 'grass', 'water', 'grass', 'grass'],
  ],
  structures: [],
  spots: [gate, well, pier, bench],
  warps: [
    {
      id: 'yard-barn',
      cell: { x: 0, y: 2 },
      target: { worldId: 'barn', cell: { x: 0, y: 0 }, facing: 'right' },
    },
  ],
}
const barn: World = {
  id: 'barn',
  kind: 'interior',
  width: 2,
  height: 1,
  start: { x: 0, y: 0 },
  startFacing: 'right',
  tiles: [['floor', 'floor']],
  structures: [],
  spots: [loft],
  warps: [],
}
const yardSet: WorldSet = { id: 'yard-set', startWorldId: 'yard', worlds: { yard, barn } }
// 案内の雛形と場所名を短くし、出す案内を文字列のまま比べる
const yardText: VillageText = {
  ...text,
  headTo: '{place}へ',
  stops: {
    ...text.stops,
    gate: { ...baseStop, place: '門' },
    well: { ...baseStop, place: '井戸' },
    pier: { ...baseStop, place: '桟橋' },
    bench: { ...baseStop, place: '長椅子' },
    loft: { ...baseStop, place: '屋根裏' },
  },
}
const inYard = (x: number, y: number): TravelInput => inputAt('yard', { x, y }, yardSet, yardText)
const inBarn = (x: number, y: number): TravelInput => inputAt('barn', { x, y }, yardSet, yardText)

describe('planNext の分かれ目', () => {
  it('コース外の地点で話していても次は無く、どこへも向かわない', () => {
    expect(planNext(inYard(1, 2), bench)).toEqual(NONE)
  })

  it('同じワールドの次の地点へは、そこまでの経路を置いて会話窓を開く印を立てる', () => {
    expect(planNext(inYard(0, 0), gate)).toEqual({
      kind: 'walk',
      route: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      destination: { x: 1, y: 1 },
      speech: '井戸へ',
      autoTalk: true,
      pendingGoal: null,
    })
  })

  it('次の地点に立っていれば、その地点そのものを会話の相手にする', () => {
    const plan = planNext(inYard(1, 1), gate)

    expect(plan).toEqual({ kind: 'talk', spot: well })
    expect(expectKind(plan, 'talk').spot).toBe(well)
  })

  it('次の地点へ水を挟んで届かなければ、案内と目的地の印だけ立てる', () => {
    expect(planNext(inYard(1, 1), well)).toEqual({
      kind: 'mark',
      destination: { x: 4, y: 1 },
      speech: '桟橋へ',
    })
  })

  it('別ワールドの次の地点へは扉の床までの経路を置き、目的地の印は下ろして行き先を持つ', () => {
    expect(planNext(inYard(1, 2), pier)).toEqual({
      kind: 'walk',
      route: [{ x: 0, y: 2 }],
      destination: null,
      speech: '屋根裏へ',
      autoTalk: true,
      pendingGoal: { worldId: 'barn', spot: loft },
    })
  })

  it('別ワールドへ通じる扉まで歩いて届かなければ、どこへも向かわない', () => {
    expect(planNext(inYard(4, 1), pier)).toEqual(NONE)
  })

  it('扉の無いワールドから別ワールドの次の地点へは、どこへも向かわない', () => {
    expect(planNext(inBarn(0, 0), well)).toEqual(NONE)
  })

  it('同じワールドかどうかはワールドのidではなくworldsの鍵で比べる', () => {
    const keyed: WorldSet = { id: 'keyed', startWorldId: 'outside', worlds: { outside: yard } }

    expect(planNext(inputAt('outside', { x: 0, y: 0 }, keyed, yardText), gate)).toEqual({
      kind: 'walk',
      route: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      destination: { x: 1, y: 1 },
      speech: '井戸へ',
      autoTalk: true,
      pendingGoal: null,
    })
  })
})
