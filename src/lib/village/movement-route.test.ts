// 経路(route)追従と高速移動の step のテスト
import { CELL_MS, TURN_MS, FAST_DIVISOR, createMoveState, step } from './movement'
import { world, idle } from './movement.fixture'

describe('step (経路追従)', () => {
  it('route を渡すと順に辿り、到着ごとに arrived を返す', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]
    const r1 = step(world, createMoveState(world), { held: null, route, fast: false }, 16)
    expect(r1.state.motion?.to).toEqual({ x: 0, y: 1 })
    const r2 = step(world, r1.state, idle, CELL_MS)
    expect(r2.arrived).toEqual({ x: 0, y: 1 })
    const r3 = step(world, r2.state, idle, 16)
    expect(r3.state.motion?.to).toEqual({ x: 0, y: 0 })
  })
  it('移動中に新しい route が来たら、今のマスへの到着後に差し替える', () => {
    const r1 = step(
      world,
      createMoveState(world),
      { held: null, route: [{ x: 1, y: 0 }], fast: false },
      16
    )
    const r2 = step(world, r1.state, { held: null, route: [{ x: 0, y: 1 }], fast: false }, 16)
    expect(r2.state.motion?.to).toEqual({ x: 1, y: 0 })
    expect(r2.state.route).toEqual([{ x: 0, y: 1 }])
  })
  it('held が route より優先し、route を破棄する', () => {
    const r1 = step(
      world,
      createMoveState(world),
      { held: null, route: [{ x: 1, y: 0 }], fast: false },
      16
    )
    const r2 = step(world, r1.state, idle, CELL_MS)
    const r3 = step(world, r2.state, { held: 'left', route: null, fast: false }, 16)
    expect(r3.state.route).toEqual([])
    expect(r3.state.motion).toBeNull()
    const r4 = step(world, r3.state, { held: 'left', route: null, fast: false }, TURN_MS)
    expect(r4.state.motion?.to).toEqual({ x: 0, y: 0 })
  })
})

describe('step (高速移動)', () => {
  it('fast の route は CELL_MS / FAST_DIVISOR で到着する', () => {
    const r1 = step(
      world,
      createMoveState(world),
      { held: null, route: [{ x: 1, y: 0 }], fast: true },
      16
    )
    expect(r1.state.fast).toBe(true)
    const half = step(world, r1.state, idle, CELL_MS / FAST_DIVISOR / 2)
    expect(half.arrived).toBeNull()
    const r2 = step(world, r1.state, idle, CELL_MS / FAST_DIVISOR)
    expect(r2.arrived).toEqual({ x: 1, y: 0 })
  })
  it('fast は経路を消費し終えるまで保たれる', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]
    const r1 = step(world, createMoveState(world), { held: null, route, fast: true }, 16)
    const r2 = step(world, r1.state, idle, CELL_MS / FAST_DIVISOR)
    expect(r2.arrived).toEqual({ x: 0, y: 1 })
    expect(r2.state.fast).toBe(true)
    const r3 = step(world, r2.state, idle, 16)
    expect(r3.state.motion?.to).toEqual({ x: 0, y: 0 })
    expect(r3.state.fast).toBe(true)
  })
  it('held が入ると fast を解除して経路も捨てる', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]
    const r1 = step(world, createMoveState(world), { held: null, route, fast: true }, 16)
    const r2 = step(world, r1.state, { held: 'up', route: null, fast: false }, 16)
    expect(r2.state.fast).toBe(false)
    expect(r2.state.route).toEqual([])
  })
})

describe('step (防御)', () => {
  it('隣接しないマスから始まる route は捨てて動かない', () => {
    const r = step(
      world,
      createMoveState(world),
      { held: null, route: [{ x: 0, y: 0 }], fast: false },
      16
    )
    expect(r.state.motion).toBeNull()
    expect(r.state.route).toEqual([])
    expect(r.state.cell).toEqual({ x: 1, y: 1 })
  })
  it('経路の先頭が通れないマスなら経路を捨て、ぶつかった先を bumped に返す(扉へ向かう最後の1歩)', () => {
    const r = step(
      world,
      createMoveState(world),
      { held: null, route: [{ x: 2, y: 1 }], fast: false },
      16
    )
    expect(r.state.motion).toBeNull()
    expect(r.state.route).toEqual([])
    expect(r.state.facing).toBe('right')
    expect(r.bumped).toEqual({ x: 2, y: 1 })
  })
})
