// 釣る対象のマスが変わった時だけReactへ知らせるnotifyFishingTargetのテスト
import { describe, expect, it, vi } from 'vitest'
import type { Cell, Direction, World } from '@content/types/world'
import type { MoveState } from '@/lib/village/movement'
import { notifyFishingTarget } from './notify-fishing-target'
import type { WalkFrameState } from './types'

// 真ん中の2行が池の4×4の野原。上の岸からは下を、下の岸からは上を向くと釣れる
const pond: World = {
  id: 'pond',
  kind: 'exterior',
  width: 4,
  height: 4,
  start: { x: 1, y: 0 },
  startFacing: 'down',
  tiles: [
    ['grass', 'grass', 'grass', 'grass'],
    ['water', 'water', 'water', 'water'],
    ['water', 'water', 'water', 'water'],
    ['grass', 'grass', 'grass', 'grass'],
  ],
  structures: [],
  spots: [],
  warps: [],
}

// 止まって立っている状態
const standing = (cell: Cell, facing: Direction): MoveState => ({
  cell,
  facing,
  motion: null,
  route: [],
  fast: false,
  turnRemainingMs: 0,
  stride: 0,
})

const makeFrameState = (fishingTarget: Cell | null): WalkFrameState => ({
  spriteKey: '',
  fishingTarget,
  waitSince: null,
  enteredWorld: pond,
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

describe('notifyFishingTarget', () => {
  it('止まって池を向いたら、向いている水のマスを知らせて覚える', () => {
    const frameState = makeFrameState(null)
    const onFishingTarget = vi.fn()
    notifyFishingTarget(frameState, pond, standing({ x: 1, y: 0 }, 'down'), onFishingTarget)
    expect(onFishingTarget).toHaveBeenCalledTimes(1)
    expect(onFishingTarget).toHaveBeenCalledWith({ x: 1, y: 1 })
    expect(frameState.fishingTarget).toEqual({ x: 1, y: 1 })
  })

  it('対象が同じマスのままなら、次のフレームでは知らせない', () => {
    const frameState = makeFrameState(null)
    const onFishingTarget = vi.fn()
    const state = standing({ x: 1, y: 0 }, 'down')
    notifyFishingTarget(frameState, pond, state, onFishingTarget)
    notifyFishingTarget(frameState, pond, state, onFishingTarget)
    expect(onFishingTarget).toHaveBeenCalledTimes(1)
  })

  it('釣れない向きのまま(nullからnull)なら知らせない', () => {
    const frameState = makeFrameState(null)
    const onFishingTarget = vi.fn()
    notifyFishingTarget(frameState, pond, standing({ x: 1, y: 0 }, 'up'), onFishingTarget)
    expect(onFishingTarget).not.toHaveBeenCalled()
    expect(frameState.fishingTarget).toBeNull()
  })

  it('向きだけ変えて池に背を向けたら、nullを知らせる', () => {
    const frameState = makeFrameState({ x: 1, y: 1 })
    const onFishingTarget = vi.fn()
    notifyFishingTarget(frameState, pond, standing({ x: 1, y: 0 }, 'left'), onFishingTarget)
    expect(onFishingTarget).toHaveBeenCalledTimes(1)
    expect(onFishingTarget).toHaveBeenCalledWith(null)
    expect(frameState.fishingTarget).toBeNull()
  })

  it('池を向いていても歩いている途中は釣れないので、nullを知らせる', () => {
    const frameState = makeFrameState({ x: 1, y: 1 })
    const onFishingTarget = vi.fn()
    const walking: MoveState = {
      ...standing({ x: 1, y: 0 }, 'down'),
      motion: { from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, progress: 0.5 },
    }
    notifyFishingTarget(frameState, pond, walking, onFishingTarget)
    expect(onFishingTarget).toHaveBeenCalledWith(null)
    expect(frameState.fishingTarget).toBeNull()
  })

  it('横へ1マス移って対象のxだけが変わっても知らせる', () => {
    const frameState = makeFrameState({ x: 1, y: 1 })
    const onFishingTarget = vi.fn()
    notifyFishingTarget(frameState, pond, standing({ x: 2, y: 0 }, 'down'), onFishingTarget)
    expect(onFishingTarget).toHaveBeenCalledWith({ x: 2, y: 1 })
    expect(frameState.fishingTarget).toEqual({ x: 2, y: 1 })
  })

  it('対岸へ移って対象のyだけが変わっても知らせる', () => {
    const frameState = makeFrameState({ x: 1, y: 1 })
    const onFishingTarget = vi.fn()
    notifyFishingTarget(frameState, pond, standing({ x: 1, y: 3 }, 'up'), onFishingTarget)
    expect(onFishingTarget).toHaveBeenCalledWith({ x: 1, y: 2 })
    expect(frameState.fishingTarget).toEqual({ x: 1, y: 2 })
  })
})
