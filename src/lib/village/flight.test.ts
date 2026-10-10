// 直線飛行の着地の決め方・向き・時間の進め方・移動状態の書き換えと、描く側へ渡す位置・高さ・影・コマ・カメラの持ち上げを検査する。
// 期待値は flight-curve の関数で計算し直さず数で書く(同じ式で計算し直すと、式を壊した変異が生き残る)
import type { World } from '@content/types/world'
import { flightFacing, planFlight, tickFlight, type Flight } from './flight'
import { world } from './movement.fixture'

// world の通れるマスは (0,0) (1,0) (2,0) (0,1) (1,1) (0,2) (2,2)。(2,1) は水、(1,2) は木
describe('flightFacing', () => {
  it.each([
    [{ x: 0, y: 0 }, { x: 2, y: 0 }, 'right'],
    [{ x: 2, y: 0 }, { x: 0, y: 0 }, 'left'],
    [{ x: 0, y: 0 }, { x: 0, y: 2 }, 'down'],
    [{ x: 0, y: 2 }, { x: 0, y: 0 }, 'up'],
  ] as const)('%o から %o へは %s を向く', (from, to, facing) => {
    expect(flightFacing(from, to)).toBe(facing)
  })

  it.each([
    // 差の大きい軸が縦なら、横の差の符号に引きずられない
    [{ x: 0, y: 0 }, { x: 1, y: -3 }, 'up'],
    [{ x: 0, y: 0 }, { x: -1, y: 3 }, 'down'],
    // 差の大きい軸が横なら、縦の差の符号に引きずられない
    [{ x: 0, y: 0 }, { x: 3, y: -1 }, 'right'],
    [{ x: 0, y: 0 }, { x: -3, y: 1 }, 'left'],
  ] as const)('差の大きい軸で決める: %o → %o は %s', (from, to, facing) => {
    expect(flightFacing(from, to)).toBe(facing)
  })

  it.each([
    [{ x: 0, y: 0 }, { x: 2, y: 2 }, 'right'],
    [{ x: 2, y: 2 }, { x: 0, y: 0 }, 'left'],
    [{ x: 0, y: 2 }, { x: 2, y: 0 }, 'right'],
    [{ x: 2, y: 0 }, { x: 0, y: 2 }, 'left'],
  ] as const)('縦横の差が同じなら左右: %o → %o は %s', (from, to, facing) => {
    expect(flightFacing(from, to)).toBe(facing)
  })

  it('出発と着地が同じマスなら右を向く', () => {
    expect(flightFacing({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe('right')
  })
})

describe('planFlight', () => {
  it('空の経路では飛ばない', () => {
    expect(planFlight(world, { x: 1, y: 1 }, [], 0)).toBeNull()
  })

  it('隣の1マスだけの経路は歩く(直線1マス)', () => {
    expect(planFlight(world, { x: 1, y: 1 }, [{ x: 1, y: 0 }], 0)).toBeNull()
  })

  it('立てるマスが1つも無い経路では飛ばない', () => {
    expect(planFlight(world, { x: 1, y: 1 }, [{ x: 2, y: 1 }], 0)).toBeNull()
    expect(
      planFlight(
        world,
        { x: 0, y: 0 },
        [
          { x: 2, y: 1 },
          { x: 1, y: 2 },
        ],
        0
      )
    ).toBeNull()
  })

  it('直線の距離が2マス未満(√2)なら歩く', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]
    expect(planFlight(world, { x: 1, y: 1 }, route, 0)).toBeNull()
  })

  it('直線の距離がちょうど2マスなら飛ぶ', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]
    expect(planFlight(world, { x: 0, y: 2 }, route, 0)).toEqual({
      flight: { from: { x: 0, y: 2 }, to: { x: 0, y: 0 }, durationMs: 544, elapsedMs: 0 },
      facing: 'up',
      rest: [],
    })
  })

  it('直線の距離が2マスを超える(√5)なら飛ぶ', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]
    expect(planFlight(world, { x: 0, y: 2 }, route, 0)).toEqual({
      flight: { from: { x: 0, y: 2 }, to: { x: 1, y: 0 }, durationMs: 552, elapsedMs: 0 },
      facing: 'up',
      rest: [],
    })
  })

  it('床のワープで終わる経路は、そのマス(立てる)へ降りる', () => {
    const warped: World = {
      ...world,
      warps: [
        {
          id: 'floor',
          cell: { x: 2, y: 0 },
          target: { worldId: 'home', cell: { x: 0, y: 0 }, facing: 'up' },
        },
      ],
    }
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]
    expect(planFlight(warped, { x: 0, y: 2 }, route, 0)).toEqual({
      flight: { from: { x: 0, y: 2 }, to: { x: 2, y: 0 }, durationMs: 571, elapsedMs: 0 },
      facing: 'right',
      rest: [],
    })
  })

  it('壁の扉へ向かう経路は扉の隣へ降り、扉へぶつかる最後の1歩を残す', () => {
    const route = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]
    expect(planFlight(world, { x: 0, y: 0 }, route, 0)).toEqual({
      flight: { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, durationMs: 544, elapsedMs: 0 },
      facing: 'right',
      rest: [{ x: 2, y: 1 }],
    })
  })

  it('扉の隣が経路の最初のマスでも、そこが2マス離れていれば降りる', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]
    expect(planFlight(world, { x: 0, y: 2 }, route, 0)).toEqual({
      flight: { from: { x: 0, y: 2 }, to: { x: 0, y: 0 }, durationMs: 544, elapsedMs: 0 },
      facing: 'up',
      rest: [{ x: 2, y: 1 }],
    })
  })

  it('途中の通れないマスは見ず、最後の立てるマスへ降りる', () => {
    const route = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]
    expect(planFlight(world, { x: 0, y: 0 }, route, 0)).toEqual({
      flight: { from: { x: 0, y: 0 }, to: { x: 2, y: 2 }, durationMs: 571, elapsedMs: 0 },
      facing: 'right',
      rest: [],
    })
  })

  it('距離は出発と着地の差から測る(どちらの座標も0でない組)', () => {
    // 横の差 -1・縦の差 -2 で √5。和で測ると √13 になり 595ms になる
    expect(planFlight(world, { x: 2, y: 2 }, [{ x: 1, y: 0 }], 0)?.flight.durationMs).toBe(552)
    // 横の差 -2・縦の差 -1 で √5
    expect(planFlight(world, { x: 2, y: 2 }, [{ x: 0, y: 1 }], 0)?.flight.durationMs).toBe(552)
  })

  it('前のマスから持ち越した時間を飛び立った時の経過にする', () => {
    const route = [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ]
    expect(planFlight(world, { x: 0, y: 2 }, route, 37)?.flight.elapsedMs).toBe(37)
  })
})

describe('tickFlight', () => {
  const flight: Flight = {
    from: { x: 0, y: 2 },
    to: { x: 0, y: 0 },
    durationMs: 544,
    elapsedMs: 100,
  }

  it('飛ぶ時間に届くまでは経過を足すだけ', () => {
    expect(tickFlight(flight, 16)).toEqual({ landed: false, flight: { ...flight, elapsedMs: 116 } })
    expect(tickFlight(flight, 443)).toEqual({
      landed: false,
      flight: { ...flight, elapsedMs: 543 },
    })
  })

  it('ちょうど飛ぶ時間に届いた歩みで着地のマスを返す', () => {
    expect(tickFlight(flight, 444)).toEqual({ landed: true, cell: { x: 0, y: 0 } })
  })

  it('飛ぶ時間を過ぎた歩みでも着地のマスだけを返し、余りの時間は返さない', () => {
    expect(tickFlight(flight, 500)).toEqual({ landed: true, cell: { x: 0, y: 0 } })
  })
})
