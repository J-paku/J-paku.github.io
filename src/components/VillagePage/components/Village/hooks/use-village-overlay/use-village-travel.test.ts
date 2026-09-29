// @vitest-environment happy-dom
// 重ね表示を閉じた後の道中(useVillageTravel)のテスト。次へ(goNext)・地図の一覧からの移動(travel)・
// 地図のマスを押した移動(travelTo)が、runtimeへ置く経路・目的地・会話窓を開く印と、呼び出し元へ渡す
// 案内・目的地の印を分岐ごとに正しく立てるかを見る。歩行ループは起こされたことだけを見て、実際には歩かせない
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Cell, Spot, VillageText, World, WorldSet } from '@content/types/world'
import { createMoveState } from '@/lib/village/movement'
import { findPath, nearestReachable } from '@/lib/village/path'
import type { SpotRef } from '@/lib/village/spot'
import { headToSpeech } from '../../utils/spot-text'
import type { VillageRuntime } from '../use-village-runtime'
import { useVillageTravel } from './use-village-travel'

// server-onlyはNext.jsのビルド境界専用ガードで、vitestでは無条件に例外を投げる。
// テストでは中身を持たないmockに差し替え、読み込み専用の@/lib/content/readを素通しにする
vi.mock('server-only', () => ({}))

import { readVillageText, readWorldSet } from '@/lib/content/read'

const worldSet = readWorldSet()
const text = readVillageText('ja')

const pick = <T>(label: string, found: T | null | undefined): T => {
  if (found === null || found === undefined) throw new Error(`${label}がcontentに無い`)
  return found
}

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

// runtimeの束を最小の形で作る。worldKeyのワールドのcellに立って止まっている所から始める。
// このフックが触らない欄(held・fishingPoseなど)は型を満たすための初期値
const createRuntime = (worldKey: string, cell: Cell, set: WorldSet = worldSet): VillageRuntime => {
  const world = set.worlds[worldKey]
  return {
    world: { current: world },
    worldKey: { current: worldKey },
    state: { current: { ...createMoveState(world), cell } },
    destination: { current: null },
    pendingRoute: { current: null },
    pendingFast: { current: false },
    pendingGoal: { current: null },
    autoTalk: { current: false },
    locked: { current: false },
    held: { current: null },
    scrollHeld: { current: null },
    pointerTarget: { current: null },
    fishingPose: { current: null },
    umbrellaPose: { current: null },
    visited: { current: new Set() },
    activeSpot: { current: null },
    actions: { current: { onTalk: () => {}, onMap: () => {}, onEscape: () => {} } },
    buttons: { current: { onA: () => {}, onB: () => {} } },
    wake: { current: vi.fn() },
  }
}

const renderTravel = (
  runtime: VillageRuntime,
  set: WorldSet = worldSet,
  villageText: VillageText = text
) => {
  const callbacks = {
    setDestination: vi.fn(),
    setSpeech: vi.fn(),
    arrive: vi.fn(),
    closeOverlay: vi.fn(),
    openTalk: vi.fn(),
  }
  const { result } = renderHook(() =>
    useVillageTravel({ worldSet: set, text: villageText, runtime, ...callbacks })
  )
  return { result, ...callbacks }
}

// どこへも向かわなかった: 経路も目的地も置かず、案内も出さず、歩行ループも起こさない
const expectNoDeparture = (runtime: VillageRuntime, travel: ReturnType<typeof renderTravel>) => {
  expect(runtime.pendingRoute.current).toBeNull()
  expect(runtime.destination.current).toBeNull()
  expect(runtime.wake.current).not.toHaveBeenCalled()
  expect(travel.setDestination).not.toHaveBeenCalled()
  expect(travel.setSpeech).not.toHaveBeenCalled()
}

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

describe('goNext(次へ)', () => {
  it('会話中の地点が無ければ重ね表示を閉じるだけで、どこへも向かわない', () => {
    const runtime = createRuntime(hereId, here.start)
    const travel = renderTravel(runtime)

    act(() => travel.result.current.goNext())

    expect(travel.closeOverlay).toHaveBeenCalledTimes(1)
    expect(travel.openTalk).not.toHaveBeenCalled()
    expectNoDeparture(runtime, travel)
  })

  it('コースの最後の地点からは次が無く、閉じるだけ', () => {
    const runtime = createRuntime(lastRef.worldId, lastRef.spot.cell)
    runtime.activeSpot.current = lastRef.spot
    const travel = renderTravel(runtime)

    act(() => travel.result.current.goNext())

    expect(travel.closeOverlay).toHaveBeenCalledTimes(1)
    expect(travel.openTalk).not.toHaveBeenCalled()
    expectNoDeparture(runtime, travel)
  })

  it('同じワールドの次の地点へは経路を置いて高速で歩き、着いたら会話窓を開く印を立てる', () => {
    const { from, next } = sameWorldLeg
    const runtime = createRuntime(hereId, here.start)
    runtime.activeSpot.current = from.spot
    // 別ワールドへ向かう途中の行き先が残っている
    runtime.pendingGoal.current = crossWorldLeg.next
    const travel = renderTravel(runtime)

    act(() => travel.result.current.goNext())

    expect(travel.closeOverlay).toHaveBeenCalledTimes(1)
    expect(runtime.pendingRoute.current).toEqual(findPath(here, here.start, next.spot.cell))
    expect(runtime.pendingRoute.current?.at(-1)).toEqual(next.spot.cell)
    expect(runtime.pendingFast.current).toBe(true)
    expect(runtime.autoTalk.current).toBe(true)
    expect(runtime.destination.current).toEqual(next.spot.cell)
    expect(travel.setDestination).toHaveBeenCalledWith(next.spot.cell)
    expect(travel.setSpeech).toHaveBeenCalledWith(headToSpeech(text, next.spot))
    // 扉を出た所で古い案内に戻さないよう、別ワールドの行き先は捨てる
    expect(runtime.pendingGoal.current).toBeNull()
    expect(runtime.wake.current).toHaveBeenCalledTimes(1)
    expect(travel.openTalk).not.toHaveBeenCalled()
  })

  it('すでに次の地点に立っていれば、歩かずにその場で会話窓を開く', () => {
    const { from, next } = sameWorldLeg
    const runtime = createRuntime(hereId, next.spot.cell)
    runtime.activeSpot.current = from.spot
    const travel = renderTravel(runtime)

    act(() => travel.result.current.goNext())

    expect(runtime.activeSpot.current).toBe(next.spot)
    expect(travel.openTalk).toHaveBeenCalledTimes(1)
    expectNoDeparture(runtime, travel)
  })

  it('別ワールドの次の地点へは、そこへ通じる扉まで高速で歩いて出る', () => {
    const { from, next } = crossWorldLeg
    const runtime = createRuntime(from.worldId, from.spot.cell)
    runtime.activeSpot.current = from.spot
    // 前の行き先の印が残っている
    runtime.destination.current = from.spot.cell
    const travel = renderTravel(runtime)

    act(() => travel.result.current.goNext())

    expect(runtime.pendingRoute.current?.at(-1)).toEqual(
      warpCellTo(worldSet.worlds[from.worldId], next.worldId)
    )
    expect(runtime.pendingFast.current).toBe(true)
    expect(runtime.autoTalk.current).toBe(true)
    // 目的地と案内は扉を出た所で到着の処理が立て直すので、行き先の地点ごと持っておく
    expect(runtime.pendingGoal.current).toEqual(next)
    // 前の行き先の印は下ろす(残すと別の地点に印が残る)
    expect(runtime.destination.current).toBeNull()
    expect(travel.setDestination).toHaveBeenCalledWith(null)
    expect(travel.setSpeech).toHaveBeenCalledWith(headToSpeech(text, next.spot))
    expect(runtime.wake.current).toHaveBeenCalledTimes(1)
  })

  it('同じワールドの次の地点へ歩いて届かなければ、案内と目的地の印だけ立てて歩かない', () => {
    const runtime = createRuntime('field', near.cell, fieldSet)
    runtime.activeSpot.current = near
    const travel = renderTravel(runtime, fieldSet, fieldText)

    act(() => travel.result.current.goNext())

    expect(travel.setSpeech).toHaveBeenCalledWith(headToSpeech(fieldText, far))
    expect(runtime.destination.current).toEqual(far.cell)
    expect(travel.setDestination).toHaveBeenCalledWith(far.cell)
    expect(runtime.pendingRoute.current).toBeNull()
    expect(runtime.wake.current).not.toHaveBeenCalled()
  })

  it('別ワールドの次の地点へ通じる扉が無ければ、閉じるだけでどこへも向かわない', () => {
    const runtime = createRuntime('field', far.cell, fieldSet)
    runtime.activeSpot.current = far
    const travel = renderTravel(runtime, fieldSet, fieldText)

    act(() => travel.result.current.goNext())

    expect(travel.closeOverlay).toHaveBeenCalledTimes(1)
    expect(runtime.pendingGoal.current).toBeNull()
    expectNoDeparture(runtime, travel)
  })
})

describe('travel(地図の一覧から)', () => {
  it('一覧に無いidなら閉じるだけで、どこへも向かわない', () => {
    const runtime = createRuntime(hereId, here.start)
    const travel = renderTravel(runtime)

    act(() => travel.result.current.travel('実在しない地点'))

    expect(travel.closeOverlay).toHaveBeenCalledTimes(1)
    expect(travel.arrive).not.toHaveBeenCalled()
    expectNoDeparture(runtime, travel)
  })

  it('同じワールドの地点へは高速で歩き、会話窓を開く印と別ワールドの行き先は取り消す', () => {
    const runtime = createRuntime(hereId, here.start)
    // 次へで出発した後、地図から行き先を変える
    runtime.autoTalk.current = true
    runtime.pendingGoal.current = crossWorldLeg.next
    const travel = renderTravel(runtime)

    act(() => travel.result.current.travel(offCourse.id))

    expect(travel.closeOverlay).toHaveBeenCalledTimes(1)
    expect(runtime.pendingRoute.current).toEqual(findPath(here, here.start, offCourse.cell))
    expect(runtime.pendingRoute.current?.at(-1)).toEqual(offCourse.cell)
    expect(runtime.pendingFast.current).toBe(true)
    expect(runtime.autoTalk.current).toBe(false)
    expect(runtime.pendingGoal.current).toBeNull()
    expect(runtime.destination.current).toEqual(offCourse.cell)
    expect(travel.setDestination).toHaveBeenCalledWith(offCourse.cell)
    expect(travel.setSpeech).toHaveBeenCalledWith(headToSpeech(text, offCourse))
    expect(runtime.wake.current).toHaveBeenCalledTimes(1)
    expect(travel.arrive).not.toHaveBeenCalled()
  })

  it('その地点に立っていれば、歩かずに到着として扱う', () => {
    const runtime = createRuntime(hereId, offCourse.cell)
    runtime.pendingGoal.current = crossWorldLeg.next
    const travel = renderTravel(runtime)

    act(() => travel.result.current.travel(offCourse.id))

    expect(travel.arrive).toHaveBeenCalledWith(offCourse.cell)
    expect(runtime.pendingGoal.current).toBeNull()
    expectNoDeparture(runtime, travel)
  })

  it('別ワールドの地点へは扉まで高速で歩いて出るが、着いても会話窓は開かない', () => {
    const runtime = createRuntime(hereId, here.start)
    runtime.autoTalk.current = true
    const travel = renderTravel(runtime)

    act(() => travel.result.current.travel(elsewhere.spot.id))

    expect(runtime.pendingRoute.current?.at(-1)).toEqual(warpCellTo(here, elsewhere.worldId))
    expect(runtime.pendingFast.current).toBe(true)
    expect(runtime.autoTalk.current).toBe(false)
    expect(runtime.pendingGoal.current).toEqual(elsewhere)
    expect(runtime.destination.current).toBeNull()
    expect(travel.setDestination).toHaveBeenCalledWith(null)
    expect(travel.setSpeech).toHaveBeenCalledWith(headToSpeech(text, elsewhere.spot))
    expect(runtime.wake.current).toHaveBeenCalledTimes(1)
  })

  it('歩いて届かない地点なら何もしない(別ワールドへ向かう途中の行き先もそのまま)', () => {
    const runtime = createRuntime('field', near.cell, fieldSet)
    const goal: SpotRef = { worldId: 'annex', spot: shed }
    runtime.pendingGoal.current = goal
    const travel = renderTravel(runtime, fieldSet, fieldText)

    act(() => travel.result.current.travel(far.id))

    expect(runtime.pendingGoal.current).toBe(goal)
    expect(travel.arrive).not.toHaveBeenCalled()
    expectNoDeparture(runtime, travel)
  })
})

describe('travelTo(地図のマスを押して)', () => {
  it('通れないマスを押すと歩いて届く最も近いマスまで高速で歩き、そこが地点でなければ案内は出さない', () => {
    const goal = pick('水のマスの近く', nearestReachable(here, here.start, waterCell))
    // 前提: 水のマスそのものには立てず、止まる所は地点の立ち位置でもない
    expect(goal).not.toEqual(waterCell)
    expect(here.spots.some(spot => spot.cell.x === goal.x && spot.cell.y === goal.y)).toBe(false)
    const runtime = createRuntime(hereId, here.start)
    runtime.autoTalk.current = true
    runtime.pendingGoal.current = crossWorldLeg.next
    const travel = renderTravel(runtime)

    act(() => travel.result.current.travelTo(waterCell))

    expect(travel.closeOverlay).toHaveBeenCalledTimes(1)
    expect(runtime.pendingRoute.current).toEqual(findPath(here, here.start, goal))
    expect(runtime.pendingRoute.current?.at(-1)).toEqual(goal)
    expect(runtime.pendingFast.current).toBe(true)
    expect(runtime.autoTalk.current).toBe(false)
    expect(runtime.pendingGoal.current).toBeNull()
    expect(runtime.destination.current).toEqual(goal)
    expect(travel.setDestination).toHaveBeenCalledWith(goal)
    expect(travel.setSpeech).not.toHaveBeenCalled()
    expect(runtime.wake.current).toHaveBeenCalledTimes(1)
  })

  it('地点の立ち位置を押すと、その地点への案内を出す', () => {
    const spot = sameWorldLeg.next.spot
    const runtime = createRuntime(hereId, here.start)
    const travel = renderTravel(runtime)

    act(() => travel.result.current.travelTo(spot.cell))

    expect(runtime.destination.current).toEqual(spot.cell)
    expect(travel.setSpeech).toHaveBeenCalledWith(headToSpeech(text, spot))
    expect(runtime.wake.current).toHaveBeenCalledTimes(1)
  })

  it('今立っているマスを押すと、歩かずに到着として扱う', () => {
    const runtime = createRuntime(hereId, here.start)
    runtime.pendingGoal.current = crossWorldLeg.next
    const travel = renderTravel(runtime)

    act(() => travel.result.current.travelTo(here.start))

    expect(travel.arrive).toHaveBeenCalledWith(here.start)
    expect(runtime.pendingGoal.current).toBeNull()
    expectNoDeparture(runtime, travel)
  })
})
