// 移動状態遷移 step・directionTo のテスト
import type { Cell } from '@content/types/world'
import { CELL_MS, TURN_MS, createMoveState, step, directionTo, type MoveState } from './movement'
import { world, idle } from './movement.fixture'

describe('step', () => {
  it('押下方向へ1マスの移動を開始し、CELL_MS 経過で到着する', () => {
    const s0 = createMoveState(world)
    expect(s0.fast).toBe(false)
    const r1 = step(world, s0, { held: 'up', route: null, fast: false }, 16)
    expect(r1.state.facing).toBe('up')
    expect(r1.state.motion?.to).toEqual({ x: 1, y: 0 })
    expect(r1.arrived).toBeNull()
    expect(r1.bumped).toBeNull()
    const r2 = step(world, r1.state, idle, CELL_MS)
    expect(r2.state.cell).toEqual({ x: 1, y: 0 })
    expect(r2.arrived).toEqual({ x: 1, y: 0 })
    expect(r2.state.motion).toBeNull()
  })
  it('壁方向は向きだけ変えて動かず、bumped にそのマスを返す', () => {
    const r = step(world, createMoveState(world), { held: 'right', route: null, fast: false }, 16)
    expect(r.state.facing).toBe('right')
    expect(r.state.motion).toBeNull()
    expect(r.state.cell).toEqual({ x: 1, y: 1 })
    expect(r.bumped).toEqual({ x: 2, y: 1 })
  })
  it('木に向かって歩くと bumped になる', () => {
    const r = step(world, createMoveState(world), { held: 'down', route: null, fast: false }, 16)
    expect(r.bumped).toEqual({ x: 1, y: 2 })
    expect(r.state.facing).toBe('down')
    expect(r.state.motion).toBeNull()
  })
  it('長いフレームでも1ステップで1マスしか進まない', () => {
    const r1 = step(world, createMoveState(world), { held: 'up', route: null, fast: false }, 16)
    const r2 = step(world, r1.state, { held: 'up', route: null, fast: false }, CELL_MS * 5)
    expect(r2.state.cell).toEqual({ x: 1, y: 0 })
    expect(r2.state.motion).toBeNull()
  })
})

// 歩きの滑らかさ: 余剰時間の持ち越しと、到着フレームでの連結
describe('step (連続歩行)', () => {
  it('マスをまたいだ余剰時間を次のマスの進捗へ持ち越す', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]
    const r1 = step(world, createMoveState(world), { held: null, route, fast: false }, 16)
    const r2 = step(world, r1.state, idle, 16)
    // 16 + CELL_MS で1マスを16ms超過。超過分だけ次のマスが進んでいる
    const r3 = step(world, r2.state, idle, CELL_MS)
    expect(r3.arrived).toEqual({ x: 0, y: 1 })
    expect(r3.state.motion?.to).toEqual({ x: 0, y: 0 })
    expect(r3.state.motion?.progress).toBeCloseTo(16 / CELL_MS)
  })
  it('押し続けている間は到着フレームでも motion が途切れない', () => {
    const held = { held: 'up' as const, route: null, fast: false }
    let state: MoveState = { ...createMoveState(world), cell: { x: 0, y: 2 }, facing: 'up' }
    let arrivals = 0
    let stalls = 0
    // 1マス16フレーム。2マス目に着くまでに motion が null になるフレームを数える
    for (let i = 0; i < 40; i += 1) {
      const r = step(world, state, held, 16)
      state = r.state
      if (r.arrived !== null) arrivals += 1
      if (arrivals >= 2) break
      if (state.motion === null) stalls += 1
    }
    expect(arrivals).toBe(2)
    expect(stalls).toBe(0)
    expect(state.cell).toEqual({ x: 0, y: 0 })
  })
  it('押し続けたまま壁の手前へ到着したら bumped だけ返して動かない', () => {
    const held = { held: 'up' as const, route: null, fast: false }
    const r1 = step(world, createMoveState(world), held, 16)
    const r2 = step(world, r1.state, held, CELL_MS)
    expect(r2.arrived).toEqual({ x: 1, y: 0 })
    expect(r2.bumped).toEqual({ x: 1, y: -1 })
    expect(r2.state.motion).toBeNull()
    expect(r2.state.cell).toEqual({ x: 1, y: 0 })
  })
  it('通れる次のマスへ繋ぐ長いフレームでも、持ち越した進捗は1マス分を超えない', () => {
    const held = { held: 'up' as const, route: null, fast: false }
    // (0,2) から上は (0,1)・(0,0) と 2 マス続けて通れる。連結先が通行不可だと余りが捨てられ、上限を通らない
    const start: MoveState = { ...createMoveState(world), cell: { x: 0, y: 2 }, facing: 'up' }
    const r1 = step(world, start, held, 16)
    expect(r1.state.motion?.to).toEqual({ x: 0, y: 1 })
    const r2 = step(world, r1.state, held, CELL_MS * 5)
    expect(r2.arrived).toEqual({ x: 0, y: 1 })
    expect(r2.state.motion?.to).toEqual({ x: 0, y: 0 })
    // 余りは 4 マス分あるが、持ち越しは 1 マス分で頭打ち。超えると 1 フレームで壁を飛び越える
    expect(r2.state.motion?.progress).toBeLessThanOrEqual(1)
  })
  it('arrived は1マスにつき1回だけ返る', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]
    let state = step(world, createMoveState(world), { held: null, route, fast: false }, 16).state
    const seen: Cell[] = []
    for (let i = 0; i < 40; i += 1) {
      const r = step(world, state, idle, 16)
      state = r.state
      if (r.arrived !== null) seen.push(r.arrived)
    }
    expect(seen).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ])
  })
})

describe('directionTo', () => {
  it('隣接マスへの向きを返す', () => {
    expect(directionTo({ x: 1, y: 1 }, { x: 1, y: 0 })).toBe('up')
    expect(directionTo({ x: 1, y: 1 }, { x: 2, y: 1 })).toBe('right')
  })
  it('左・下も返す(4 方向すべて)', () => {
    // right は判定が尽きた時の既定でもあるので、left を単独で押さえないと左判定の欠落に気付けない
    expect(directionTo({ x: 1, y: 1 }, { x: 0, y: 1 })).toBe('left')
    expect(directionTo({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe('down')
  })
})

// 旋回と軸足の状態は経路移動にも共通する
describe('step (旋回と歩行)', () => {
  it('方向変更の短押しではその場で向きだけ変わる', () => {
    const turned = step(world, createMoveState(world), { ...idle, held: 'left' }, 16)
    expect(turned.state.facing).toBe('left')
    expect(turned.state.motion).toBeNull()
    const released = step(world, turned.state, idle, 16)
    expect(released.state.cell).toEqual(world.start)
    expect(released.state.turnRemainingMs).toBe(0)
  })
  it('旋回後も押し続けると一歩進み、離しても開始した一歩は完了する', () => {
    const held = { ...idle, held: 'left' as const }
    const turned = step(world, createMoveState(world), held, 16)
    const waiting = step(world, turned.state, held, TURN_MS - 1)
    expect(waiting.state.motion).toBeNull()
    const begun = step(world, waiting.state, held, 1)
    expect(begun.state.motion?.to).toEqual({ x: 0, y: 1 })
    const arrived = step(world, begun.state, idle, CELL_MS)
    expect(arrived.state.cell).toEqual({ x: 0, y: 1 })
    expect(arrived.state.stride).toBe(1)
    expect(step(world, arrived.state, idle, CELL_MS).state.motion).toBeNull()
  })
  it('軸足は到着した一歩ごとに交代し、壁への衝突では変わらない', () => {
    let state = createMoveState(world)
    for (const [index, cell] of [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ].entries()) {
      state = step(world, state, { ...idle, route: [cell] }, 16).state
      state = step(world, state, idle, CELL_MS).state
      expect(state.stride).toBe((index + 1) % 2)
    }
    const bumped = step(world, state, { ...idle, held: 'up' }, 16)
    expect(bumped.state.stride).toBe(state.stride)
  })
})
