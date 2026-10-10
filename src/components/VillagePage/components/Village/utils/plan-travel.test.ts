// 重ね表示を閉じた後の道中を決める純粋関数(planNext・planTravel・planTravelTo)のテスト。
// 前半は元のフックのテスト(use-village-travel.test.ts、renderHook)が見ていた15の動きを、同じ実データ・同じ期待値で
// 結果の形として確かめる。後半は小さな作りのワールドで、分かれ目ごとの境を具体的な経路・案内の値で固める。
// 結果を runtime と state へ当てる配線(重ね表示を閉じる・高速の印・歩行ループを起こす)はフックの側にあり、E2E が見る
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import { findPath, nearestReachable } from '@/lib/village/path'
import { spotWorldId, type SpotRef } from '@/lib/village/spot'
import {
  planNext,
  planTravel,
  planTravelTo,
  type TravelInput,
  type TravelPlan,
} from './plan-travel'
import { headToSpeech } from './spot-text'

// server-onlyはNext.jsのビルド境界専用ガードで、vitestでは無条件に例外を投げる。
// テストでは中身を持たないmockに差し替え、読み込み専用の@/lib/content/readを素通しにする
vi.mock('server-only', () => ({}))

// libの経路探索と地点の引き当ては中身をそのまま通す。実際には null を返さない所で、型が許す null を
// 受けた時に何もしないことだけを、その1回だけ null(や別のワールド)を返させて確かめる
vi.mock('@/lib/village/path', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/village/path')>()
  return {
    ...actual,
    findPath: vi.fn(actual.findPath),
    nearestReachable: vi.fn(actual.nearestReachable),
  }
})
vi.mock('@/lib/village/spot', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/village/spot')>()
  return { ...actual, spotWorldId: vi.fn(actual.spotWorldId) }
})

import { readVillageText, readWorldSet } from '@/lib/content/read'

afterEach(() => {
  vi.mocked(findPath).mockReset()
  vi.mocked(nearestReachable).mockReset()
  vi.mocked(spotWorldId).mockReset()
})

const worldSet = readWorldSet()
const text = readVillageText('ja')

const pick = <T>(label: string, found: T | null | undefined): T => {
  if (found === null || found === undefined) throw new Error(`${label}がcontentに無い`)
  return found
}

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

// 全ワールドの地点を、それぞれが属するワールドのidと組にする
const allRefs: SpotRef[] = Object.entries(worldSet.worlds).flatMap(([worldId, world]) =>
  world.spots.map(spot => ({ worldId, spot }))
)
// コース地点を全ワールド通しのorder順に並べ、続けて歩く2地点ずつの組にする
const course = allRefs
  .filter(ref => ref.spot.order !== undefined)
  .sort((a, b) => (a.spot.order ?? 0) - (b.spot.order ?? 0))
const legs = course.slice(1).map((next, i) => ({ from: course[i], next }))
const sameWorldLeg = pick(
  '同じワールドで続くコース地点',
  legs.find(leg => leg.from.worldId === leg.next.worldId)
)
const crossWorldLeg = pick(
  'ワールドをまたいで続くコース地点',
  legs.find(leg => leg.from.worldId !== leg.next.worldId)
)
const lastRef = pick('コースの最後の地点', course.at(-1))

// 同じワールドで続く組のあるワールド(屋外)。地図からの移動はここの開始マスから始める
const hereId = sameWorldLeg.next.worldId
const here = worldSet.worlds[hereId]
// hereにあるコース外の地点(地図からは移動できる)と、別のワールドにある地点
const offCourse = pick(
  'コース外の地点',
  here.spots.find(spot => spot.order === undefined)
)
const elsewhere = pick(
  '別のワールドの地点',
  allRefs.find(ref => ref.worldId !== hereId)
)
// 通れないマスの例として、hereの水のマス
const cellsOf = (world: World) =>
  world.tiles.flatMap((row, y) => row.map((tile, x) => ({ tile, cell: { x, y } })))
const waterCell = pick(
  '水のマス',
  cellsOf(here).find(entry => entry.tile === 'water')
).cell

// worldの中で、worldIdのワールドへ通じる扉のマス
const warpCellTo = (world: World, worldId: string): Cell =>
  pick(
    `${worldId}へ通じる扉`,
    world.warps.find(warp => warp.target.worldId === worldId)
  ).cell

// 水(x2)で東西に分かれた1行のワールドfieldと、どこからも扉の通じていないannex。
// コースはfieldの西の端(near)→東の端(far)→annex(shed)の順で、nearからfarへもfarからshedへも歩いて行けない
const near: Spot = { id: 'near', cell: { x: 0, y: 0 }, facing: 'up', order: 1 }
const far: Spot = { id: 'far', cell: { x: 4, y: 0 }, facing: 'up', order: 2 }
const shed: Spot = { id: 'shed', cell: { x: 0, y: 0 }, facing: 'up', order: 3 }
const field: World = {
  id: 'field',
  kind: 'exterior',
  width: 5,
  height: 1,
  start: near.cell,
  startFacing: 'right',
  tiles: [['grass', 'grass', 'water', 'grass', 'grass']],
  structures: [],
  spots: [near, far],
  warps: [],
}
const annex: World = {
  id: 'annex',
  kind: 'interior',
  width: 1,
  height: 1,
  start: shed.cell,
  startFacing: 'up',
  tiles: [['floor']],
  structures: [],
  spots: [shed],
  warps: [],
}
const fieldSet: WorldSet = { id: 'field-set', startWorldId: 'field', worlds: { field, annex } }
// 案内は地点ごとの文言から場所名を引くので、小さなワールドの地点にも文言を足す
const baseStop = Object.values(text.stops)[0]
const fieldText: VillageText = {
  ...text,
  stops: {
    ...text.stops,
    near: { ...baseStop, place: '西の岸' },
    far: { ...baseStop, place: '東の岸' },
    shed: { ...baseStop, place: '離れ' },
  },
}

describe('元のフックのテストから移した動き', () => {
  describe('planNext(次へ)', () => {
    it('会話中の地点が無ければ、どこへも向かわない', () => {
      expect(planNext(inputAt(hereId, here.start), null)).toEqual(NONE)
    })

    it('コースの最後の地点からは次が無く、どこへも向かわない', () => {
      expect(planNext(inputAt(lastRef.worldId, lastRef.spot.cell), lastRef.spot)).toEqual(NONE)
    })

    it('同じワールドの次の地点へは経路を置いて歩き、着いたら会話窓を開く印を立てる', () => {
      const { from, next } = sameWorldLeg
      const plan = expectKind(planNext(inputAt(hereId, here.start), from.spot), 'walk')

      expect(plan).toEqual({
        kind: 'walk',
        route: findPath(here, here.start, next.spot.cell),
        destination: next.spot.cell,
        speech: headToSpeech(text, next.spot),
        autoTalk: true,
        // 扉を出た所で古い案内に戻さないよう、別ワールドの行き先は捨てる
        pendingGoal: null,
      })
      expect(plan.route.at(-1)).toEqual(next.spot.cell)
    })

    it('すでに次の地点に立っていれば、歩かずにその場で会話窓を開く', () => {
      const { from, next } = sameWorldLeg
      const plan = expectKind(planNext(inputAt(hereId, next.spot.cell), from.spot), 'talk')

      expect(plan.spot).toBe(next.spot)
    })

    it('別ワールドの次の地点へは、そこへ通じる扉まで歩いて出る', () => {
      const { from, next } = crossWorldLeg
      const plan = expectKind(planNext(inputAt(from.worldId, from.spot.cell), from.spot), 'walk')

      expect(plan.route.at(-1)).toEqual(warpCellTo(worldSet.worlds[from.worldId], next.worldId))
      expect(plan.autoTalk).toBe(true)
      // 目的地と案内は扉を出た所で到着の処理が立て直すので、行き先の地点ごと持っておく
      expect(plan.pendingGoal).toEqual(next)
      // 前の行き先の印は下ろす(残すと別の地点に印が残る)
      expect(plan.destination).toBeNull()
      expect(plan.speech).toBe(headToSpeech(text, next.spot))
    })

    it('同じワールドの次の地点へ歩いて届かなければ、案内と目的地の印だけ立てて歩かない', () => {
      expect(planNext(inputAt('field', near.cell, fieldSet, fieldText), near)).toEqual({
        kind: 'mark',
        destination: far.cell,
        speech: headToSpeech(fieldText, far),
      })
    })

    it('別ワールドの次の地点へ通じる扉が無ければ、どこへも向かわない', () => {
      expect(planNext(inputAt('field', far.cell, fieldSet, fieldText), far)).toEqual(NONE)
    })
  })

  describe('planTravel(地図の一覧から)', () => {
    it('一覧に無いidなら、どこへも向かわない', () => {
      expect(planTravel(inputAt(hereId, here.start), '実在しない地点')).toEqual(NONE)
    })

    it('同じワールドの地点へは歩き、会話窓を開く印と別ワールドの行き先は取り消す', () => {
      const plan = expectKind(planTravel(inputAt(hereId, here.start), offCourse.id), 'walk')

      expect(plan).toEqual({
        kind: 'walk',
        route: findPath(here, here.start, offCourse.cell),
        destination: offCourse.cell,
        speech: headToSpeech(text, offCourse),
        autoTalk: false,
        pendingGoal: null,
      })
      expect(plan.route.at(-1)).toEqual(offCourse.cell)
    })

    it('その地点に立っていれば、歩かずに到着として扱う', () => {
      expect(planTravel(inputAt(hereId, offCourse.cell), offCourse.id)).toEqual({
        kind: 'arrive',
        cell: offCourse.cell,
      })
    })

    it('別ワールドの地点へは扉まで歩いて出るが、着いても会話窓は開かない', () => {
      const plan = expectKind(planTravel(inputAt(hereId, here.start), elsewhere.spot.id), 'walk')

      expect(plan.route.at(-1)).toEqual(warpCellTo(here, elsewhere.worldId))
      expect(plan.autoTalk).toBe(false)
      expect(plan.pendingGoal).toEqual(elsewhere)
      expect(plan.destination).toBeNull()
      expect(plan.speech).toBe(headToSpeech(text, elsewhere.spot))
    })

    it('歩いて届かない地点なら何もしない(別ワールドへ向かう途中の行き先もそのまま)', () => {
      expect(planTravel(inputAt('field', near.cell, fieldSet, fieldText), far.id)).toEqual(NONE)
    })
  })

  describe('planTravelTo(地図のマスを押して)', () => {
    it('通れないマスを押すと歩いて届く最も近いマスまで歩き、そこが地点でなければ案内は出さない', () => {
      const goal = pick('水のマスの近く', nearestReachable(here, here.start, waterCell))
      // 前提: 水のマスそのものには立てず、止まる所は地点の立ち位置でもない
      expect(goal).not.toEqual(waterCell)
      expect(here.spots.some(spot => spot.cell.x === goal.x && spot.cell.y === goal.y)).toBe(false)
      const plan = expectKind(planTravelTo(inputAt(hereId, here.start), waterCell), 'walkSilently')

      expect(plan).toEqual({
        kind: 'walkSilently',
        route: findPath(here, here.start, goal),
        destination: goal,
        autoTalk: false,
        pendingGoal: null,
      })
      expect(plan.route.at(-1)).toEqual(goal)
    })

    it('地点の立ち位置を押すと、その地点への案内を出す', () => {
      const spot = sameWorldLeg.next.spot
      const plan = expectKind(planTravelTo(inputAt(hereId, here.start), spot.cell), 'walk')

      expect(plan.destination).toEqual(spot.cell)
      expect(plan.speech).toBe(headToSpeech(text, spot))
    })

    it('今立っているマスを押すと、歩かずに到着として扱う', () => {
      expect(planTravelTo(inputAt(hereId, here.start), here.start)).toEqual({
        kind: 'arrive',
        cell: here.start,
      })
    })
  })
})

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

describe('planTravel の分かれ目', () => {
  it('同じワールドのコース外の地点へは、そこまでの経路を置き会話窓は開かない', () => {
    // benchはyardの4番目の地点。先頭の地点(gate)と取り違えると、立っているgateへの到着になる
    expect(planTravel(inYard(0, 0), 'bench')).toEqual({
      kind: 'walk',
      route: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
      destination: { x: 1, y: 2 },
      speech: '長椅子へ',
      autoTalk: false,
      pendingGoal: null,
    })
  })

  it('選んだ地点に立っていれば、その地点の立ち位置へ到着する', () => {
    const plan = planTravel(inYard(1, 2), 'bench')

    expect(plan).toEqual({ kind: 'arrive', cell: { x: 1, y: 2 } })
    expect(expectKind(plan, 'arrive').cell).toBe(bench.cell)
  })

  it('同じワールドで水を挟んで届かない地点へは、どこへも向かわない', () => {
    expect(planTravel(inYard(0, 0), 'pier')).toEqual(NONE)
  })

  it('別ワールドの地点へは扉の床までの経路を置き、会話窓は開かずに行き先を持つ', () => {
    expect(planTravel(inYard(1, 2), 'loft')).toEqual({
      kind: 'walk',
      route: [{ x: 0, y: 2 }],
      destination: null,
      speech: '屋根裏へ',
      autoTalk: false,
      pendingGoal: { worldId: 'barn', spot: loft },
    })
  })

  it('別ワールドへ通じる扉まで歩いて届かなければ、どこへも向かわない', () => {
    expect(planTravel(inYard(4, 1), 'loft')).toEqual(NONE)
  })

  it('引き当てたワールドにその地点が無ければ、どこへも向かわない', () => {
    // spotWorldIdはその地点を持つワールドを返すので実際には起きない。型が許す食い違いを受けた時の振る舞い
    vi.mocked(spotWorldId).mockReturnValueOnce('barn')

    expect(planTravel(inYard(1, 2), 'bench')).toEqual(NONE)
  })
})

describe('planTravelTo の分かれ目', () => {
  it('通れないマスを押すと、届く最も近い地点でないマスまで案内なしで歩く', () => {
    // 止まる(1,0)は門と行が、井戸・長椅子と列が同じだが、どの地点の立ち位置でもない
    expect(planTravelTo(inYard(0, 0), { x: 2, y: 0 })).toEqual({
      kind: 'walkSilently',
      route: [{ x: 1, y: 0 }],
      destination: { x: 1, y: 0 },
      autoTalk: false,
      pendingGoal: null,
    })
  })

  it('地点の立ち位置を押すと、その地点への案内を出して歩く', () => {
    expect(planTravelTo(inYard(0, 0), { x: 1, y: 1 })).toEqual({
      kind: 'walk',
      route: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      destination: { x: 1, y: 1 },
      speech: '井戸へ',
      autoTalk: false,
      pendingGoal: null,
    })
  })

  it('水の向こうを押して止まるマスが地点の立ち位置なら、その地点の案内を出す', () => {
    expect(planTravelTo(inYard(0, 0), { x: 4, y: 1 })).toEqual({
      kind: 'walk',
      route: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      destination: { x: 1, y: 1 },
      speech: '井戸へ',
      autoTalk: false,
      pendingGoal: null,
    })
  })

  it('立っているマスを押すと、そのマスそのものへ到着する', () => {
    const input = inYard(0, 0)
    const plan = planTravelTo(input, { x: 0, y: 0 })

    expect(plan).toEqual({ kind: 'arrive', cell: { x: 0, y: 0 } })
    expect(expectKind(plan, 'arrive').cell).toBe(input.cell)
  })

  it('届く最も近いマスが無いと言われたら、どこへも向かわない', () => {
    // nearestReachableは出発のマスを必ず候補に持つので実際には null を返さない
    vi.mocked(nearestReachable).mockReturnValueOnce(null)

    expect(planTravelTo(inYard(0, 0), { x: 1, y: 1 })).toEqual(NONE)
  })

  it('最も近いマスまでの経路が無いと言われたら、どこへも向かわない', () => {
    // 最も近いマスは歩いて届くマスから選ぶので、実際には経路が見つかる
    vi.mocked(findPath).mockReturnValueOnce(null)

    expect(planTravelTo(inYard(0, 0), { x: 1, y: 1 })).toEqual(NONE)
  })
})
