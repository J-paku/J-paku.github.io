// ポインタ入力から経路を作る部品(replanTowardPointer・queueTapRoute)のテスト。
// 次のマスへ歩いている途中で経路を作り直しても、到着後の経路が途切れないことを確かめる
import { describe, expect, it, vi } from 'vitest'
import type { Cell, Direction } from '@content/types/world'
import { createMoveState, type MoveState } from '@/lib/village/movement'
import { findPath } from '@/lib/village/path'
import { queueTapRoute, replanTowardPointer } from './route-pointer'
import type { MoveRefs, WalkFrameState } from './types'

// server-only は vitest(node 環境)では無条件に例外を投げるので、中身を持たない mock に差し替える
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

const town = readWorldSet().worlds.town
const start = town.start

// 出発マスから 4 歩以上離れた、歩いて届くマスを 1 つ選ぶ(実データの地形に依存しないため探して決める)
const pickFarTarget = (): Cell => {
  for (let y = 0; y < town.height; y++) {
    for (let x = 0; x < town.width; x++) {
      const route = findPath(town, start, { x, y })
      if (route !== null && route.length >= 4) return { x, y }
    }
  }
  throw new Error('town に 4 歩以上離れたマスが無い')
}
const target = pickFarTarget()
const firstLeg = findPath(town, start, target) as Cell[]
// 歩き始めた 1 歩目のマス。移動中はここへ向かっている
const heading = firstLeg[0]
// 通れないマス(盤の外)
const blocked: Cell = { x: -1, y: -1 }

const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y

// start から heading へ半分まで進んだ状態。経路の残りも持たせる
const movingState = (): MoveState => ({
  ...createMoveState(town),
  motion: { from: start, to: heading, progress: 0.5 },
  route: firstLeg.slice(1),
})

const makeRefs = (state: MoveState, pointerTarget: Cell | null): MoveRefs => ({
  world: { current: town },
  state: { current: state },
  pendingRoute: { current: null },
  pendingFast: { current: false },
  autoTalk: { current: true },
  locked: { current: false },
  held: { current: null as Direction | null },
  pointerTarget: { current: pointerTarget },
})

const makeFrameState = (): WalkFrameState => ({
  spriteKey: '',
  fishingTarget: null,
  waitSince: null,
  enteredWorld: town,
  ignoreHeld: false,
  plannedTarget: null,
  staleTarget: false,
  smoothedCam: null,
  paintedWorld: null,
  shift: '',
  lastTransform: '',
  frameWidth: null,
  veilCell: '',
  veilId: '',
})

describe('replanTowardPointer', () => {
  it('移動中に作り直すと、経路は向かっているマスの次から始まる', () => {
    const refs = makeRefs(movingState(), target)
    replanTowardPointer(makeFrameState(), refs, null, () => {})
    const route = refs.pendingRoute.current
    expect(route).not.toBeNull()
    const planned = route as Cell[]
    expect(planned.some(c => sameCell(c, heading))).toBe(false)
    expect(Math.abs(planned[0].x - heading.x) + Math.abs(planned[0].y - heading.y)).toBe(1)
    expect(planned).toEqual(findPath(town, heading, target))
  })

  it('目標が変わった時だけ retarget を 1 回呼ぶ', () => {
    const refs = makeRefs(movingState(), target)
    const frameState = makeFrameState()
    const retarget = vi.fn()
    replanTowardPointer(frameState, refs, null, retarget)
    expect(retarget).toHaveBeenCalledTimes(1)
    expect(retarget).toHaveBeenCalledWith(target)
    // 同じ目標を押したまま(経路は残っている)なら呼ばない
    replanTowardPointer(frameState, refs, null, retarget)
    expect(retarget).toHaveBeenCalledTimes(1)
  })

  it('通れないマスへ目標を動かしても retarget を呼ばず、経路も置かない', () => {
    const refs = makeRefs(movingState(), blocked)
    const retarget = vi.fn()
    replanTowardPointer(makeFrameState(), refs, null, retarget)
    expect(retarget).not.toHaveBeenCalled()
    expect(refs.pendingRoute.current).toBeNull()
  })

  it('向かっているマスそのものが目標なら、残りの経路を空にして retarget を呼ぶ', () => {
    const refs = makeRefs(movingState(), heading)
    const retarget = vi.fn()
    replanTowardPointer(makeFrameState(), refs, null, retarget)
    expect(retarget).toHaveBeenCalledTimes(1)
    expect(retarget).toHaveBeenCalledWith(heading)
    expect(refs.pendingRoute.current).toEqual([])
  })

  it('扉を hold すると最後の1歩が扉へ向かう', () => {
    const door = town.warps.find(warp => warp.target.worldId === 'room')
    if (door === undefined) throw new Error('自宅の扉が無い')
    const refs = makeRefs(createMoveState(town), door.cell)
    const retarget = vi.fn()
    replanTowardPointer(makeFrameState(), refs, null, retarget)
    expect(retarget).toHaveBeenCalledWith(door.cell)
    expect(refs.pendingRoute.current?.at(-1)).toEqual(door.cell)
  })
})

describe('queueTapRoute', () => {
  it('扉を tap すると最後の1歩が扉へ向かう', () => {
    const door = town.warps.find(warp => warp.target.worldId === 'room')
    if (door === undefined) throw new Error('自宅の扉が無い')
    const refs = makeRefs(createMoveState(town), door.cell)
    expect(queueTapRoute(refs, door.cell)).toBe(true)
    expect(refs.pendingRoute.current?.at(-1)).toEqual(door.cell)
  })

  it('移動中のタップも、経路は向かっているマスの次から始まる', () => {
    const refs = makeRefs(movingState(), null)
    expect(queueTapRoute(refs, target)).toBe(true)
    const planned = refs.pendingRoute.current as Cell[]
    expect(planned.some(c => sameCell(c, heading))).toBe(false)
    expect(Math.abs(planned[0].x - heading.x) + Math.abs(planned[0].y - heading.y)).toBe(1)
    expect(planned).toEqual(findPath(town, heading, target))
  })

  it('向かっているマスそのものをタップしたら true を返し、残りの経路を空にする', () => {
    const refs = makeRefs(movingState(), null)
    expect(queueTapRoute(refs, heading)).toBe(true)
    expect(refs.pendingRoute.current).toEqual([])
  })

  it('止まっている時に自分のマスや通れないマスをタップしても false', () => {
    const refs = makeRefs(createMoveState(town), null)
    expect(queueTapRoute(refs, start)).toBe(false)
    expect(queueTapRoute(refs, blocked)).toBe(false)
    expect(refs.pendingRoute.current).toBeNull()
  })
})
