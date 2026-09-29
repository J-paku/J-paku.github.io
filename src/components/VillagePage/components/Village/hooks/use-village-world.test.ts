// @vitest-environment happy-dom
// 今いるワールドと移動状態(useVillageWorld)のテスト。描く側のstateと、rAFループが読むruntimeの写しが
// enterWorldで一緒に置き換わり、持ち越した経路・目的地を捨てて、眠っている歩行ループを起こすかを見る
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createMoveState } from '@/lib/village/movement'
import type { VillageRuntime } from './use-village-runtime'
import { useVillageWorld } from './use-village-world'

// server-onlyはNext.jsのビルド境界専用ガードで、vitestでは無条件に例外を投げる。
// テストでは中身を持たないmockに差し替え、読み込み専用の@/lib/content/readを素通しにする
vi.mock('server-only', () => ({}))

import { readWorldSet } from '@/lib/content/read'

const worldSet = readWorldSet()
const startWorld = worldSet.worlds[worldSet.startWorldId]

// 開始ワールドから別のワールドへ出る扉。到着の処理(use-village-arrive)は扉の行き先をこの組でenterWorldへ渡す
const exitWarp = startWorld.warps.find(warp => warp.target.worldId !== worldSet.startWorldId)
if (exitWarp === undefined) throw new Error('開始ワールドから別のワールドへ出る扉がcontentに無い')
const nextWorldId = exitWarp.target.worldId
const nextWorld = worldSet.worlds[nextWorldId]
const { cell: entryCell, facing: entryFacing } = exitWarp.target

// 開始ワールドのコース地点の立ち位置。目的地の印を立てておく所に使う
const markedCell = startWorld.spots[0].cell

// runtimeの束を最小の形で作る。このフックが読み書きするのはworld・worldKey・state・destination・
// pendingRoute・pendingFast・wakeだけで、残りは型を満たすための初期値
const createRuntime = (): VillageRuntime => ({
  world: { current: startWorld },
  worldKey: { current: worldSet.startWorldId },
  state: { current: createMoveState(startWorld) },
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
})

const renderWorld = (runtime: VillageRuntime) =>
  renderHook(() => useVillageWorld(worldSet, runtime))

describe('useVillageWorld', () => {
  it('初期値は開始ワールドの開始マスで、目的地は無い', () => {
    const { result } = renderWorld(createRuntime())

    expect(result.current.world).toBe(startWorld)
    expect(result.current.playerCell).toEqual(startWorld.start)
    expect(result.current.destination).toBeNull()
  })

  it('enterWorldで描くワールド・立ち位置とruntimeの写しを一緒に置き換え、歩行ループを起こす', () => {
    const runtime = createRuntime()
    // 歩きかけのコマと残りの経路を持ったまま扉を抜ける
    const { x, y } = startWorld.start
    runtime.state.current = {
      ...runtime.state.current,
      motion: { from: { x, y }, to: { x, y: y + 1 }, progress: 0.5 },
      route: [{ x, y: y + 2 }],
      fast: true,
    }
    const { result } = renderWorld(runtime)

    act(() => result.current.enterWorld(nextWorldId, nextWorld, entryCell, entryFacing))

    expect(result.current.world).toBe(nextWorld)
    expect(result.current.playerCell).toEqual(entryCell)
    expect(runtime.world.current).toBe(nextWorld)
    expect(runtime.worldKey.current).toBe(nextWorldId)
    // 歩きかけのコマと経路は持ち越さず、新しいワールドの初期状態へ立ち位置と向きだけを入れる
    expect(runtime.state.current).toEqual({
      ...createMoveState(nextWorld),
      cell: entryCell,
      facing: entryFacing,
    })
    expect(runtime.wake.current).toHaveBeenCalledTimes(1)
  })

  it('enterWorldは持ち越した経路・高速移動・目的地の印を捨てる', () => {
    const runtime = createRuntime()
    const { result } = renderWorld(runtime)
    act(() => result.current.setDestination(markedCell))
    runtime.destination.current = markedCell
    runtime.pendingRoute.current = [markedCell]
    runtime.pendingFast.current = true
    expect(result.current.destination).toEqual(markedCell)

    act(() => result.current.enterWorld(nextWorldId, nextWorld, entryCell, entryFacing))

    expect(result.current.destination).toBeNull()
    expect(runtime.destination.current).toBeNull()
    expect(runtime.pendingRoute.current).toBeNull()
    expect(runtime.pendingFast.current).toBe(false)
  })

  // 保存値や移動先のidは実在しないことがあるので、引けなければ開始ワールドを描く(utils/find-world.ts)
  it('実在しないidで入ると、描くワールドは開始ワールドへ倒れる', () => {
    const { result } = renderWorld(createRuntime())

    act(() => result.current.enterWorld('実在しないワールド', nextWorld, entryCell, entryFacing))

    expect(result.current.world).toBe(startWorld)
  })

  it('enterWorldは描き直しやワールドの移動をまたいで同じ関数のまま', () => {
    const { result, rerender } = renderWorld(createRuntime())
    const first = result.current.enterWorld

    rerender()
    act(() => result.current.enterWorld(nextWorldId, nextWorld, entryCell, entryFacing))

    expect(result.current.enterWorld).toBe(first)
  })
})
