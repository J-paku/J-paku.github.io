// ポインタ入力から経路を作る部品(replanTowardPointer・queueTapRoute)のテスト。
// 次のマスへ歩いている途中で経路を作り直しても、到着後の経路が途切れないことを確かめる
import { describe, expect, it, vi } from 'vitest'
import type { Cell, Direction, Structure, Tile, World } from '@content/types/world'
import { createMoveState, type MoveState } from '@/lib/village/movement'
import { findPath } from '@/lib/village/path'
import { spotAt } from '@/lib/village/spot'
import { queueTapRoute, replanTowardPointer } from './route-pointer'
import type { MoveRefs, WalkFrameState } from './types'
import { makeOpenWorld } from './walk-loop.test-helper'

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
  shadowTransform: '',
  shadowFlying: '',
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

  it('目標の x だけがずれても作り直し、retarget を呼ぶ', () => {
    // 経路が残って歩いている間でも、押したマスが横へ動けば新しい目標へ向け直す
    const refs = makeRefs(movingState(), target)
    const frameState = { ...makeFrameState(), plannedTarget: { x: target.x + 1, y: target.y } }
    const retarget = vi.fn()
    replanTowardPointer(frameState, refs, null, retarget)
    expect(retarget).toHaveBeenCalledWith(target)
    expect(refs.pendingRoute.current).toEqual(findPath(town, heading, target))
    expect(frameState.plannedTarget).toEqual(target)
  })

  it('目標の y だけがずれても作り直し、retarget を呼ぶ', () => {
    const refs = makeRefs(movingState(), target)
    const frameState = { ...makeFrameState(), plannedTarget: { x: target.x, y: target.y + 1 } }
    const retarget = vi.fn()
    replanTowardPointer(frameState, refs, null, retarget)
    expect(retarget).toHaveBeenCalledWith(target)
    expect(refs.pendingRoute.current).toEqual(findPath(town, heading, target))
    expect(frameState.plannedTarget).toEqual(target)
  })

  it('同じ目標を押したまま経路が残っている間は、経路も自動の会話も触らない', () => {
    const refs = makeRefs(movingState(), target)
    const frameState = { ...makeFrameState(), plannedTarget: target }
    const retarget = vi.fn()
    replanTowardPointer(frameState, refs, null, retarget)
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.autoTalk.current).toBe(true)
    expect(retarget).not.toHaveBeenCalled()
  })

  it('同じ目標のまま経路を使い切っても、次のマスへ歩いている間は作り直さない', () => {
    // 足が止まるのは歩みも経路も空になった時だけ。歩いている間は着くのを待つ
    const refs = makeRefs({ ...movingState(), route: [] }, target)
    const frameState = { ...makeFrameState(), plannedTarget: target }
    replanTowardPointer(frameState, refs, null, vi.fn())
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.autoTalk.current).toBe(true)
  })

  it('同じ目標のまま止まっていても、経路が残っていれば作り直さない', () => {
    const refs = makeRefs({ ...createMoveState(town), route: firstLeg }, target)
    const frameState = { ...makeFrameState(), plannedTarget: target }
    replanTowardPointer(frameState, refs, null, vi.fn())
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.autoTalk.current).toBe(true)
  })

  it('同じ目標のまま歩みも経路も空になったら、経路を作り直して歩き直す(印は動かさない)', () => {
    // 作り直した経路は等速で辿り、自動で開く予約は取り消す。目標は変わっていないのでretargetは呼ばない
    const refs = makeRefs(createMoveState(town), target)
    refs.pendingFast.current = true
    const frameState = { ...makeFrameState(), plannedTarget: target }
    const retarget = vi.fn()
    replanTowardPointer(frameState, refs, null, retarget)
    expect(refs.pendingRoute.current).toEqual(findPath(town, start, target))
    expect(refs.pendingFast.current).toBe(false)
    expect(refs.autoTalk.current).toBe(false)
    expect(retarget).not.toHaveBeenCalled()
  })

  it('止まっている時に自分のマスを押しても、経路を置かず retarget も呼ばない', () => {
    // 経路は空で歩いてもいないので、置くものが無い。押した目標だけは覚える
    const refs = makeRefs(createMoveState(town), start)
    const frameState = makeFrameState()
    const retarget = vi.fn()
    replanTowardPointer(frameState, refs, null, retarget)
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.autoTalk.current).toBe(true)
    expect(retarget).not.toHaveBeenCalled()
    expect(frameState.plannedTarget).toEqual(start)
  })

  it('向きを押している間はポインタを読まず、経路も作った目標の覚えも触らない', () => {
    const refs = makeRefs(createMoveState(town), target)
    const planned = { x: 0, y: 0 }
    const frameState = { ...makeFrameState(), plannedTarget: planned }
    const retarget = vi.fn()
    replanTowardPointer(frameState, refs, 'down', retarget)
    expect(refs.pendingRoute.current).toBeNull()
    expect(retarget).not.toHaveBeenCalled()
    expect(frameState.plannedTarget).toBe(planned)
  })

  it('ポインタを離したら、作った目標の覚えを消す', () => {
    const refs = makeRefs(createMoveState(town), null)
    const frameState = { ...makeFrameState(), plannedTarget: target }
    replanTowardPointer(frameState, refs, null, vi.fn())
    expect(frameState.plannedTarget).toBeNull()
    expect(refs.pendingRoute.current).toBeNull()
  })
})

describe('queueTapRoute', () => {
  it('扉を tap すると最後の1歩が扉へ向かう', () => {
    const door = town.warps.find(warp => warp.target.worldId === 'room')
    if (door === undefined) throw new Error('自宅の扉が無い')
    const refs = makeRefs(createMoveState(town), door.cell)
    expect(queueTapRoute(refs, door.cell)).toEqual({ kind: 'walk', goal: door.cell })
    expect(refs.pendingRoute.current?.at(-1)).toEqual(door.cell)
  })

  it('移動中のタップも、経路は向かっているマスの次から始まる', () => {
    const refs = makeRefs(movingState(), null)
    expect(queueTapRoute(refs, target)).toEqual({ kind: 'walk', goal: target })
    const planned = refs.pendingRoute.current as Cell[]
    expect(planned.some(c => sameCell(c, heading))).toBe(false)
    expect(Math.abs(planned[0].x - heading.x) + Math.abs(planned[0].y - heading.y)).toBe(1)
    expect(planned).toEqual(findPath(town, heading, target))
  })

  it('タップの経路は前に置いた高速の印を下ろして等速で歩く', () => {
    const refs = makeRefs(createMoveState(town), null)
    refs.pendingFast.current = true
    expect(queueTapRoute(refs, target)).toEqual({ kind: 'walk', goal: target })
    expect(refs.pendingFast.current).toBe(false)
  })

  it('向かっているマスそのものをタップしたらwalkを返し、残りの経路を空にする', () => {
    const refs = makeRefs(movingState(), null)
    expect(queueTapRoute(refs, heading)).toEqual({ kind: 'walk', goal: heading })
    expect(refs.pendingRoute.current).toEqual([])
  })

  it('止まっている時に自分のマスや通れないマスをタップしてもnull', () => {
    const refs = makeRefs(createMoveState(town), null)
    expect(queueTapRoute(refs, start)).toBeNull()
    expect(queueTapRoute(refs, blocked)).toBeNull()
    expect(refs.pendingRoute.current).toBeNull()
  })

  it('飛んでいる間のタップは読まず、経路も置かず自動の会話も取り消さない', () => {
    // 歩いて届くマスでも、飛んでいる最中(cell は出発のマスのまま)なら経路にしない
    const refs = makeRefs(
      {
        ...createMoveState(town),
        flight: { from: start, to: target, durationMs: 600, elapsedMs: 100 },
      },
      null
    )
    expect(queueTapRoute(refs, target)).toBeNull()
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.autoTalk.current).toBe(true)
  })
})

// 地点の物(ここでは町のポスト)を押した時。話しかけるマスまで歩き、着いたら話しかける(autoTalk)
describe('queueTapRoute (地点の物)', () => {
  const mailbox = town.spots.find(spot => spot.id === 'mailbox')
  const post = town.structures.find(s => s.id === 'mailbox')
  if (mailbox === undefined || post === undefined || post.kind !== 'mailbox') {
    throw new Error('町のポストが無い')
  }
  // 自宅前から最も近い、ポストに話しかけられるマスまでの歩数(候補を全部歩いて数える)
  const talkCells = [-1, 0, 1].flatMap(dy =>
    [-1, 0, 1].map(dx => ({ x: post.cell.x + dx, y: post.cell.y + dy }))
  )
  const nearest = Math.min(
    ...talkCells
      .filter(c => spotAt(town, c)?.id === 'mailbox')
      .map(c => findPath(town, start, c)?.length ?? Infinity)
  )
  const idle = () => {
    const refs = makeRefs(createMoveState(town), post.cell)
    refs.autoTalk.current = false
    return refs
  }

  it('離れた所から押すと、話しかけられる最短のマスへの経路を置き、印はそのマスに立てる', () => {
    const refs = idle()
    const plan = queueTapRoute(refs, post.cell)
    const route = refs.pendingRoute.current
    if (route === null) throw new Error('経路が置かれていない')
    expect(plan).toEqual({ kind: 'walk', goal: route.at(-1) })
    expect(spotAt(town, route.at(-1) ?? start)?.id).toBe('mailbox')
    expect(route).toHaveLength(nearest)
    // 速さは舞台のタップと同じ。着いたら話しかける
    expect(refs.pendingFast.current).toBe(false)
    expect(refs.autoTalk.current).toBe(true)
  })

  it('もう話しかけられるマスに止まっていれば、歩かずにその地点へ話しかける', () => {
    const refs = makeRefs({ ...createMoveState(town), cell: mailbox.cell }, post.cell)
    expect(queueTapRoute(refs, post.cell)).toEqual({ kind: 'talk', spot: mailbox })
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.autoTalk.current).toBe(false)
  })

  it('話しかけるマスへ向かっている途中に押すと、残りの経路を空にしてそのマスで話しかける', () => {
    const from = { x: mailbox.cell.x - 1, y: mailbox.cell.y }
    const refs = makeRefs(
      { ...createMoveState(town), cell: from, motion: { from, to: mailbox.cell, progress: 0.5 } },
      post.cell
    )
    refs.autoTalk.current = false
    expect(queueTapRoute(refs, post.cell)).toEqual({ kind: 'walk', goal: mailbox.cell })
    expect(refs.pendingRoute.current).toEqual([])
    expect(refs.autoTalk.current).toBe(true)
  })

  it('物へ向かう途中で歩ける地面を押し直すと、自動の会話を取り消す', () => {
    const refs = idle()
    queueTapRoute(refs, post.cell)
    expect(refs.autoTalk.current).toBe(true)
    expect(queueTapRoute(refs, target)).toEqual({ kind: 'walk', goal: target })
    expect(refs.autoTalk.current).toBe(false)
  })

  it('地点の無い物(自宅の壁・街灯の柱)は無視する', () => {
    const refs = idle()
    const home = town.structures.find(s => s.id === 'home')
    const lamp = town.structures.find(s => s.kind === 'lamp')
    if (home === undefined || home.kind !== 'house' || lamp === undefined) {
      throw new Error('町に自宅か街灯が無い')
    }
    // 自宅の壁の左上(扉ではないマス)と、街灯の柱の根元(絵のマスの1つ下)
    expect(queueTapRoute(refs, { x: home.solid.x, y: home.solid.y })).toBeNull()
    expect(queueTapRoute(refs, { x: lamp.cell.x, y: lamp.cell.y + 1 })).toBeNull()
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.autoTalk.current).toBe(false)
  })

  it('話しかけられるマスのどれにも歩いて届かない物は無視する', () => {
    // 水の列(x=4)で西と東に分かれた草地。西の(2,3)に立ち、東のポストを押す
    const islandPost: Structure = { id: 'post', kind: 'mailbox', cell: { x: 6, y: 3 } }
    const open = makeOpenWorld('island', 8, 8, [islandPost])
    const island: World = {
      ...open,
      tiles: open.tiles.map(row => row.map((tile, x): Tile => (x === 4 ? 'water' : tile))),
      spots: [{ id: 'post', structureId: 'post', cell: { x: 6, y: 4 }, facing: 'up' }],
    }
    const refs = makeRefs({ ...createMoveState(island), cell: { x: 2, y: 3 } }, null)
    refs.world.current = island
    refs.autoTalk.current = false
    expect(queueTapRoute(refs, islandPost.cell)).toBeNull()
    expect(refs.pendingRoute.current).toBeNull()
    expect(refs.autoTalk.current).toBe(false)
  })

  it('押しっぱなしのマスが物のままなら経路を作り直さず、自動の会話も残す', () => {
    // 押した瞬間はタップと押しっぱなしの両方が同じ物のマスを指す。押しっぱなし側が経路を置き直すと自動の会話が消える
    const refs = idle()
    queueTapRoute(refs, post.cell)
    const placed = refs.pendingRoute.current
    const retarget = vi.fn()
    replanTowardPointer(makeFrameState(), refs, null, retarget)
    expect(refs.pendingRoute.current).toBe(placed)
    expect(refs.autoTalk.current).toBe(true)
    expect(retarget).not.toHaveBeenCalled()
  })
})
