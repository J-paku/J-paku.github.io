// 直線飛行の着地の決め方・向き・時間の進め方・移動状態の書き換えと、描く側へ渡す位置・高さ・影・コマ・カメラの持ち上げを検査する。
// 期待値は flight-curve の関数で計算し直さず数で書く(同じ式で計算し直すと、式を壊した変異が生き残る)
import type { World } from '@content/types/world'
import {
  flightCameraLift,
  flightFacing,
  flightLiftCells,
  flightLiftLimit,
  flightPosition,
  flightShadow,
  planFlight,
  tickFlight,
  type Flight,
} from './flight'
import { FLIGHT_LIFT_CELLS } from './flight-curve'
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

describe('表示(位置・浮き上がり・影)', () => {
  // 横 -4・縦 +2 の 600ms の飛行。どちらの座標も0でない組で、差を和で取り違えると値が変わる。
  // 町の真ん中の高さ(11〜13行)で、カメラは上の端で止まらず、浮き上がりは上限に届かない
  const flying = (elapsedMs: number): { flight: Flight } => ({
    flight: { from: { x: 4, y: 11 }, to: { x: 0, y: 13 }, durationMs: 600, elapsedMs },
  })

  it('飛んでいなければ位置は null、浮き上がりは0、影は等倍', () => {
    expect(flightPosition({ flight: null })).toBeNull()
    expect(flightLiftCells({ flight: null })).toBe(0)
    expect(flightShadow({ flight: null })).toBe(1)
  })

  it('飛び立った瞬間は出発のマスで地上にいる', () => {
    expect(flightPosition(flying(0))).toEqual({ x: 4, y: 11 })
    expect(flightLiftCells(flying(0))).toBe(0)
    expect(flightShadow(flying(0))).toBe(1)
  })

  it('時間の1/4で進む距離の57.8125%まで来ている(出発が速い)', () => {
    const position = flightPosition(flying(150))
    expect(position?.x).toBeCloseTo(1.6875, 12)
    expect(position?.y).toBeCloseTo(12.15625, 12)
    expect(flightLiftCells(flying(150))).toBeCloseTo(2.373046875, 12)
    expect(flightShadow(flying(150))).toBeCloseTo(0.5728515625, 12)
  })

  it('時間の1/3で最も高く(2.5マス)、影は55%', () => {
    const position = flightPosition(flying(200))
    expect(position?.x).toBeCloseTo(32 / 27, 12)
    expect(position?.y).toBeCloseTo(335 / 27, 12)
    expect(flightLiftCells(flying(200))).toBe(2.5)
    expect(flightShadow(flying(200))).toBeCloseTo(0.55, 12)
  })

  it('時間の半分で87.5%まで来て、頂点から下りている', () => {
    const position = flightPosition(flying(300))
    expect(position?.x).toBeCloseTo(0.5, 12)
    expect(position?.y).toBeCloseTo(12.75, 12)
    expect(flightLiftCells(flying(300))).toBeCloseTo(2.109375, 12)
    expect(flightShadow(flying(300))).toBeCloseTo(0.6203125, 12)
  })

  it('飛ぶ時間に届けば着地のマスで地上にいる', () => {
    expect(flightPosition(flying(600))).toEqual({ x: 0, y: 13 })
    expect(flightLiftCells(flying(600))).toBe(0)
    expect(flightShadow(flying(600))).toBe(1)
  })
})

describe('flightLiftLimit', () => {
  // 絵の上端は立つマスの上辺の1マス上。カメラは上の端でワールドの y = 0 に止まるので、
  // 地上の縦 y で絵の上端が画面の上端から離れているのは y - 1 マス
  it.each([
    // 上端の行は立っているだけで絵が1マス上へ出ている。浮かない(負にしない)
    [0, 0],
    [0.5, 0],
    // 1行目は立った絵の上端がちょうど画面の上端
    [1, 0],
    [1.25, 0.25],
    [3, 2],
    [3.5, 2.5],
    // 5行目の上限は4マスで、曲線の最も高い2.5マスより高い(抑えない)
    [5, 4],
    [12, 11],
  ])('地上の縦 %s マスでは %s マスまで浮ける', (groundY, limit) => {
    expect(flightLiftLimit(groundY)).toBe(limit)
  })
})

describe('上の端の近くの浮き上がり', () => {
  // 真上へ8マス、600ms で飛んで row 行目へ降りる。時間の割合 t で地上の縦は row + 8(1 - t)³。
  // 曲線の高さは 150ms で 2.373046875、200ms(頂点)で 2.5、300ms で 2.109375、400ms で 1.25 マス
  const rising = (row: number, elapsedMs: number): { flight: Flight } => ({
    flight: { from: { x: 14, y: row + 8 }, to: { x: 14, y: row }, durationMs: 600, elapsedMs },
  })

  it.each([
    // 上端の行へ降りる。150ms は地上 3.375 で上限 2.375 にわずかに届かない。
    // 200ms は地上 64/27 で上限 37/27 に抑える。300ms は地上ちょうど1行目、400ms は 8/27 で、どちらも浮かない
    [0, [2.373046875, 37 / 27, 0, 0]],
    // 1行目へ降りる。200ms は上限 64/27、300ms は地上2行目で上限1、400ms は上限 8/27 に抑える
    [1, [2.373046875, 64 / 27, 1, 8 / 27]],
    // 3行目・5行目へ降りる間は上限に届かず、曲線の高さのまま
    [3, [2.373046875, 2.5, 2.109375, 1.25]],
    [5, [2.373046875, 2.5, 2.109375, 1.25]],
  ] as const)('%s 行目へ降りる飛行の 150・200・300・400ms の浮き上がりは %o', (row, lifts) => {
    const actual = [150, 200, 300, 400].map(at => flightLiftCells(rising(row, at)))
    lifts.forEach((lift, i) => expect(actual[i]).toBeCloseTo(lift, 12))
  })

  it('上端の行へ降りる間も、飛び立ちと着地の瞬間は地上にいる', () => {
    expect(flightLiftCells(rising(0, 0))).toBe(0)
    expect(flightLiftCells(rising(0, 600))).toBe(0)
  })

  it('上限で浮かない所でも負にはならず、影は等倍・カメラも持ち上げない', () => {
    // 400ms は地上 8/27 行目で、上限の計算 8/27 - 1 は負
    expect(flightLiftCells(rising(0, 400))).toBe(0)
    expect(flightShadow(rising(0, 400))).toBe(1)
    expect(flightCameraLift(rising(0, 400))).toBe(0)
  })

  it('影の倍率とカメラの持ち上げも、上限で抑えた浮き上がりから決める', () => {
    // 200ms は 37/27 マスに抑える。影は 1 - 0.45 × (37/27) / 2.5 = 113/150、持ち上げはその半分の 37/54
    expect(flightShadow(rising(0, 200))).toBeCloseTo(113 / 150, 12)
    expect(flightCameraLift(rising(0, 200))).toBeCloseTo(37 / 54, 12)
  })

  it.each([0, 1, 3, 5])(
    '%s 行目へ降りる間のどの時刻でも、絵の上端は画面の上端を越えない(立っているだけで越える所では浮かない)',
    row => {
      for (let at = 0; at <= 600; at += 1) {
        const flying = rising(row, at)
        const groundY = flightPosition(flying)?.y ?? Number.NaN
        // 地上の縦 groundY で立った絵の上端は groundY - 1。画面の上端(y = 0)とその小さい方より上へは出ない
        const top = groundY - 1 - flightLiftCells(flying)
        expect(top).toBeGreaterThanOrEqual(Math.min(0, groundY - 1) - 1e-12)
      }
    }
  )

  it.each([0, 1])('%s 行目へ降りる間、浮き上がりは 1ms で 0.05 マスを超えて跳ばない', row => {
    // 曲線は 1ms に最大およそ0.028マス、上限は地上の速さで最大0.04マス変わる。小さい方を取っても切れ目は出ない
    const lifts = Array.from({ length: 601 }, (_, at) => flightLiftCells(rising(row, at)))
    const steps = lifts.slice(1).map((lift, i) => Math.abs(lift - lifts[i]))
    expect(Math.max(...steps)).toBeLessThan(0.05)
  })

  it('上端の行へ降りる飛行でも、途中では最も高い2.5マス近くまで浮く(飛ぶこと自体は残る)', () => {
    const lifts = Array.from({ length: 601 }, (_, at) => flightLiftCells(rising(0, at)))
    expect(Math.max(...lifts)).toBeGreaterThan(2.3)
  })
})

describe('flightCameraLift', () => {
  // 600ms の飛行。時間の1/3(200ms)で最も高い。町の真ん中の高さで、浮き上がりは上限に届かない
  const flying = (elapsedMs: number): { flight: Flight } => ({
    flight: { from: { x: 4, y: 11 }, to: { x: 0, y: 13 }, durationMs: 600, elapsedMs },
  })

  it('飛んでいなければ、また飛び立ちと着地の瞬間はカメラを持ち上げない', () => {
    expect(flightCameraLift({ flight: null })).toBe(0)
    expect(flightCameraLift(flying(0))).toBe(0)
    expect(flightCameraLift(flying(600))).toBe(0)
  })

  it('最も高い時(2.5マス)に1.25マス持ち上げる', () => {
    expect(flightCameraLift(flying(200))).toBe(1.25)
  })

  it('時間の1/4(浮き上がり2.373046875マス)では1.1865234375マス持ち上げる', () => {
    expect(flightCameraLift(flying(150))).toBeCloseTo(1.1865234375, 12)
  })

  it('最も高い時も、絵の上端と影が枠の真ん中から上下4マス(端から半マスの余白)に収まる', () => {
    const apex = flying(200)
    expect(flightLiftCells(apex)).toBe(FLIGHT_LIFT_CELLS)
    const camera = flightCameraLift(apex)
    // 真ん中からの位置(マス、上が負)。表示枠は縦9マスで、見えるのは上下4.5マス。
    // 絵の上端は、地上のマスの下辺から浮き上がりだけ上にある足の2マス上。影は地上のマスの下辺まで
    const top = camera - FLIGHT_LIFT_CELLS - 1.5
    const shadow = camera + 0.5
    expect(top).toBeGreaterThanOrEqual(-4)
    expect(shadow).toBeLessThanOrEqual(4)
    // 持ち上げない時(上端 -4)より頭の上の余白が広い
    expect(top).toBeGreaterThan(-4)
  })
})
