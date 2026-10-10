// ワールドの出入り(resolveWorld・enterRuntimeWorld)のテスト。描くワールドが実在しない id で開始ワールドへ
// 倒れることと、rAFループが読むruntimeの写しが新しいワールドへ置き換わり、持ち越した経路・目的地を捨てるかを見る
import { describe, expect, it, vi } from 'vitest'
import type { SpotRef } from '@/lib/village/spot'
import { createMoveState } from '@/lib/village/movement'
import { enterRuntimeWorld, resolveWorld, type WorldEntryRefs } from './enter-world'

// server-onlyはvitest(node環境)では無条件に例外を投げるので、中身を持たないmockに差し替える
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

// 開始ワールドの開始マスに立ち、経路も目的地も無い写し
const createRefs = (): WorldEntryRefs => ({
  world: { current: startWorld },
  worldKey: { current: worldSet.startWorldId },
  state: { current: createMoveState(startWorld) },
  destination: { current: null },
  pendingRoute: { current: null },
  pendingFast: { current: false },
})

describe('resolveWorld', () => {
  it('一覧にあるidはそのワールドそのものを返す', () => {
    expect(resolveWorld(worldSet, worldSet.startWorldId)).toBe(startWorld)
    expect(resolveWorld(worldSet, nextWorldId)).toBe(nextWorld)
  })

  // 保存値や移動先のidは実在しないことがあるので、引けなければ開始ワールドを描く
  it('実在しないidは開始ワールドへ倒れる', () => {
    expect(resolveWorld(worldSet, '実在しないワールド')).toBe(startWorld)
    expect(resolveWorld(worldSet, 'constructor')).toBe(startWorld)
  })
})

describe('enterRuntimeWorld', () => {
  it('ワールド・その鍵・移動状態を新しいワールドへ置き換える', () => {
    const refs = createRefs()
    // 歩きかけのコマと残りの経路を持ったまま扉を抜ける
    const { x, y } = startWorld.start
    refs.state.current = {
      ...refs.state.current,
      motion: { from: { x, y }, to: { x, y: y + 1 }, progress: 0.5 },
      route: [{ x, y: y + 2 }],
      fast: true,
    }

    enterRuntimeWorld(refs, nextWorldId, nextWorld, entryCell, entryFacing)

    expect(refs.world.current).toBe(nextWorld)
    expect(refs.worldKey.current).toBe(nextWorldId)
    // 歩きかけのコマと経路は持ち越さず、新しいワールドの初期状態へ立ち位置と向きだけを入れる
    expect(refs.state.current).toEqual({
      ...createMoveState(nextWorld),
      cell: entryCell,
      facing: entryFacing,
    })
  })

  it('持ち越した経路・高速移動・目的地の印を捨てる', () => {
    const refs = createRefs()
    refs.destination.current = markedCell
    refs.pendingRoute.current = [markedCell]
    refs.pendingFast.current = true

    enterRuntimeWorld(refs, nextWorldId, nextWorld, entryCell, entryFacing)

    expect(refs.destination.current).toBeNull()
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.pendingFast.current).toBe(false)
  })

  // 別ワールドの地点へ向かう途中の行き先と自動の会話は、扉を出た所で到着の処理が立て直すまで持つ
  it('置き換える写しの外(向かう途中の行き先・自動の会話)には触れない', () => {
    const goal: SpotRef = { worldId: nextWorldId, spot: nextWorld.spots[0] }
    const refs = { ...createRefs(), pendingGoal: { current: goal }, autoTalk: { current: true } }

    enterRuntimeWorld(refs, nextWorldId, nextWorld, entryCell, entryFacing)

    expect(refs.pendingGoal.current).toBe(goal)
    expect(refs.autoTalk.current).toBe(true)
  })
})
