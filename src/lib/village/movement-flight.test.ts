// 自動移動(fly の経路)を step が直線飛行で辿るかの検査。飛び立ち・飛ぶ間の入力の錠・着地・扉への最後の1歩
import type { Cell, World } from '@content/types/world'
import { CELL_MS, FAST_DIVISOR, createMoveState, step, type MoveState } from './movement'
import { world, idle } from './movement.fixture'

// world の通れるマスは (0,0) (1,0) (2,0) (0,1) (1,1) (0,2) (2,2)。(2,1) は水、(1,2) は木
const at = (cell: Cell): MoveState => ({ ...createMoveState(world), cell, facing: 'up' })
const travel = (route: Cell[]) => ({ held: null, route, fast: true, fly: true })
// (0,2) から北の端を回って (2,0) へ。直線で √8 マス、1255ms
const corner: Cell[] = [
  { x: 0, y: 1 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
]
// (0,0) から (2,1) の扉(水のマスに置いたワープ)へ。扉の隣 (2,0) まで直線で2マス、1180ms
const doorWorld: World = {
  ...world,
  warps: [
    {
      id: 'door',
      cell: { x: 2, y: 1 },
      target: { worldId: 'home', cell: { x: 0, y: 0 }, facing: 'up' },
    },
  ],
}
const toDoor: Cell[] = [
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
]

describe('step (飛行の開始)', () => {
  it('初期状態は飛んでおらず、飛んでよい経路も持たない', () => {
    const s0 = createMoveState(world)
    expect(s0.fly).toBe(false)
    expect(s0.flight).toBeNull()
  })

  it('止まっている所へ fly の経路が来ると、歩かずに着地のマスへ向けて飛び立つ', () => {
    const r = step(world, at({ x: 0, y: 2 }), travel(corner), 16)
    expect(r.state.flight).toEqual({
      from: { x: 0, y: 2 },
      to: { x: 2, y: 0 },
      durationMs: 1255,
      elapsedMs: 0,
    })
    expect(r.state.facing).toBe('right')
    expect(r.state.motion).toBeNull()
    expect(r.state.cell).toEqual({ x: 0, y: 2 })
    expect(r.state.route).toEqual([])
    expect(r.state.fly).toBe(false)
    expect(r.arrived).toBeNull()
    expect(r.bumped).toBeNull()
  })

  it('fly が false なら今までどおり高速で歩く', () => {
    const r = step(world, at({ x: 0, y: 2 }), { ...travel(corner), fly: false }, 16)
    expect(r.state.flight).toBeNull()
    expect(r.state.motion).toEqual({ from: { x: 0, y: 2 }, to: { x: 0, y: 1 }, progress: 0 })
    const r2 = step(world, r.state, idle, CELL_MS / FAST_DIVISOR)
    expect(r2.arrived).toEqual({ x: 0, y: 1 })
  })

  it('直線で2マスに届かない経路は fly でも高速で歩き、途中のマスからも飛び立たない', () => {
    // (1,1) から (0,2) は √2。最初の1歩の後の (1,0) からは √5 あるが、許可は最初の判定で使い切る
    const route = [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]
    const r1 = step(world, at({ x: 1, y: 1 }), travel(route), 16)
    expect(r1.state.flight).toBeNull()
    expect(r1.state.motion?.to).toEqual({ x: 1, y: 0 })
    expect(r1.state.fly).toBe(false)
    const r2 = step(world, r1.state, idle, CELL_MS / FAST_DIVISOR)
    expect(r2.arrived).toEqual({ x: 1, y: 0 })
    expect(r2.state.flight).toBeNull()
    expect(r2.state.motion?.to).toEqual({ x: 0, y: 0 })
  })

  it('隣の1マスだけの fly の経路は歩く', () => {
    const r = step(world, at({ x: 1, y: 1 }), travel([{ x: 1, y: 0 }]), 16)
    expect(r.state.flight).toBeNull()
    expect(r.state.motion?.to).toEqual({ x: 1, y: 0 })
  })

  it('先頭が隣のマスでない経路は fly でも飛ばずに捨てる', () => {
    const r = step(world, at({ x: 0, y: 2 }), travel([{ x: 0, y: 0 }]), 16)
    expect(r.state.flight).toBeNull()
    expect(r.state.motion).toBeNull()
    expect(r.state.route).toEqual([])
  })

  it('キーを押していれば fly の経路も捨てて飛ばない', () => {
    const r = step(world, at({ x: 0, y: 2 }), { ...travel(corner), held: 'up' }, 16)
    expect(r.state.flight).toBeNull()
    expect(r.state.fly).toBe(false)
    expect(r.state.route).toEqual([])
  })

  it('歩いている間に来た fly の経路は、今のマスに着いた歩みで余りの時間を持ち越して飛び立つ', () => {
    // (1,1) → (0,1) を等速で歩き始め、途中で (0,1) から (2,0) への fly の経路が来る(直線 √5、1201ms)
    const r1 = step(world, at({ x: 1, y: 1 }), { ...idle, route: [{ x: 0, y: 1 }] }, 16)
    const route = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]
    // 経路と一緒に fast も受け取るので、今の1マスも 128ms で進む
    const r2 = step(world, r1.state, travel(route), 16)
    expect(r2.state.motion?.progress).toBe(16 / (CELL_MS / FAST_DIVISOR))
    expect(r2.state.fly).toBe(true)
    const r3 = step(world, r2.state, idle, CELL_MS / FAST_DIVISOR)
    expect(r3.arrived).toEqual({ x: 0, y: 1 })
    expect(r3.state.flight).toEqual({
      from: { x: 0, y: 1 },
      to: { x: 2, y: 0 },
      durationMs: 1201,
      elapsedMs: 16,
    })
    expect(r3.state.facing).toBe('right')
  })
})

describe('step (飛んでいる間)', () => {
  const launched = (): MoveState => step(doorWorld, at({ x: 0, y: 0 }), travel(toDoor), 16).state

  it('経過だけを足し、通り過ぎるマスへの到着も衝突も返さない', () => {
    const r = step(doorWorld, launched(), idle, 300)
    expect(r.state.flight?.elapsedMs).toBe(300)
    expect(r.state.cell).toEqual({ x: 0, y: 0 })
    expect(r.arrived).toBeNull()
    expect(r.bumped).toBeNull()
  })

  it('押した向きは読まず、残りの経路(扉への1歩)も捨てない', () => {
    const r = step(doorWorld, launched(), { ...idle, held: 'down' }, 16)
    expect(r.state.flight?.elapsedMs).toBe(16)
    expect(r.state.facing).toBe('right')
    expect(r.state.route).toEqual([{ x: 2, y: 1 }])
    expect(r.state.motion).toBeNull()
    expect(r.state.turnRemainingMs).toBe(0)
    expect(r.state.fast).toBe(true)
    expect(r.bumped).toBeNull()
  })

  it('新しい経路が来ても捨て、今の飛行と残りの経路を保つ', () => {
    const r = step(
      doorWorld,
      launched(),
      { held: null, route: [{ x: 0, y: 1 }], fast: false, fly: false },
      16
    )
    expect(r.state.flight?.elapsedMs).toBe(16)
    expect(r.state.route).toEqual([{ x: 2, y: 1 }])
    expect(r.state.fast).toBe(true)
    expect(r.state.fly).toBe(false)
  })
})

describe('step (着地)', () => {
  it('着地した歩みで着地のマスを1回だけ返し、向きは飛んだ向きのまま', () => {
    let state = step(world, at({ x: 0, y: 2 }), travel(corner), 16).state
    const arrivals: Cell[] = []
    let frames = 0
    while (state.flight !== null) {
      const r = step(world, state, idle, 16)
      state = r.state
      frames += 1
      if (r.arrived !== null) arrivals.push(r.arrived)
      expect(r.bumped).toBeNull()
    }
    // 1255ms を 16ms ずつ: 78 歩みで 1248ms、79 歩みめで着地
    expect(frames).toBe(79)
    expect(arrivals).toEqual([{ x: 2, y: 0 }])
    expect(state.cell).toEqual({ x: 2, y: 0 })
    expect(state.facing).toBe('right')
    expect(state.motion).toBeNull()
    expect(state.route).toEqual([])
    const after = step(world, state, idle, 16)
    expect(after.arrived).toBeNull()
    expect(after.state.cell).toEqual({ x: 2, y: 0 })
  })

  it('飛ぶ時間ちょうどの歩みで着地する', () => {
    const launched = step(world, at({ x: 0, y: 2 }), travel(corner), 16).state
    const before = step(world, launched, idle, 1254)
    expect(before.arrived).toBeNull()
    expect(before.state.flight?.elapsedMs).toBe(1254)
    const landed = step(world, before.state, idle, 1)
    expect(landed.arrived).toEqual({ x: 2, y: 0 })
    expect(landed.state.flight).toBeNull()
  })

  it('扉へ向かう経路は扉の隣に着地した歩みで、残った1歩で扉へぶつかる', () => {
    const launched = step(doorWorld, at({ x: 0, y: 0 }), travel(toDoor), 16).state
    const r = step(doorWorld, launched, idle, 1180)
    expect(r.arrived).toEqual({ x: 2, y: 0 })
    expect(r.bumped).toEqual({ x: 2, y: 1 })
    expect(r.state.cell).toEqual({ x: 2, y: 0 })
    expect(r.state.facing).toBe('down')
    expect(r.state.motion).toBeNull()
    expect(r.state.route).toEqual([])
    expect(r.state.flight).toBeNull()
  })

  it('着地を大きく過ぎた歩みでも、残りの経路は歩き出さずに扉へぶつかって止まる', () => {
    // 着地のマスは経路のうち立てる最後のマスなので、余りの時間があっても次のマスへ歩き出す先が無い
    const launched = step(doorWorld, at({ x: 0, y: 0 }), travel(toDoor), 16).state
    const r = step(doorWorld, launched, idle, 5000)
    expect(r.arrived).toEqual({ x: 2, y: 0 })
    expect(r.bumped).toEqual({ x: 2, y: 1 })
    expect(r.state.cell).toEqual({ x: 2, y: 0 })
    expect(r.state.motion).toBeNull()
    expect(r.state.flight).toBeNull()
    expect(r.state.route).toEqual([])
  })

  it('着地した歩みでは押した向きを読まず、次の歩みから読む', () => {
    const launched = step(doorWorld, at({ x: 0, y: 0 }), travel(toDoor), 16).state
    const held = { ...idle, held: 'left' as const }
    const landed = step(doorWorld, launched, held, 1500)
    // 扉への1歩は押した向きに捨てられず、ぶつかって向きも扉の方
    expect(landed.bumped).toEqual({ x: 2, y: 1 })
    expect(landed.state.facing).toBe('down')
    expect(landed.state.motion).toBeNull()
    const next = step(doorWorld, landed.state, held, 16)
    expect(next.state.facing).toBe('left')
    expect(next.state.turnRemainingMs).toBe(64)
  })

  it('着地の後は stride を変えない(歩いた一歩ではない)', () => {
    const launched = step(world, { ...at({ x: 0, y: 2 }), stride: 1 }, travel(corner), 16).state
    const landed = step(world, launched, idle, 1255)
    expect(landed.state.stride).toBe(1)
  })
})
