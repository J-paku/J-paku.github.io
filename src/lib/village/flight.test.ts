// 直線飛行の着地の決め方・向き・時間の進め方・移動状態の書き換えと、描く側へ渡す位置・高さ・影・コマ・カメラの持ち上げを検査する。
// 高さはワールドの上端の近くで上限に抑える所(絵が画面の上へ出ない・立っているだけで出る所では浮かない・途中で跳ばない)と、
// 飛んでいる最中かの判定(isFlying。地図を開く操作を止めるのに使う)も見る。
// 期待値は flight-curve の関数で計算し直さず数で書く(同じ式で計算し直すと、式を壊した変異が生き残る)
import type { Direction, World } from '@content/types/world'
import {
  advanceFlight,
  flightCameraLift,
  flightFacing,
  flightLiftCells,
  flightLiftLimit,
  flightPose,
  flightPosition,
  flightShadow,
  isFlying,
  planFlight,
  takeOff,
  tickFlight,
  type Flight,
} from './flight'
import { FLIGHT_LIFT_CELLS } from './flight-curve'
import type { MoveState } from './movement'
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
      flight: { from: { x: 0, y: 2 }, to: { x: 0, y: 0 }, durationMs: 1180, elapsedMs: 0 },
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
      flight: { from: { x: 0, y: 2 }, to: { x: 1, y: 0 }, durationMs: 1201, elapsedMs: 0 },
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
      flight: { from: { x: 0, y: 2 }, to: { x: 2, y: 0 }, durationMs: 1255, elapsedMs: 0 },
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
      flight: { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, durationMs: 1180, elapsedMs: 0 },
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
      flight: { from: { x: 0, y: 2 }, to: { x: 0, y: 0 }, durationMs: 1180, elapsedMs: 0 },
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
      flight: { from: { x: 0, y: 0 }, to: { x: 2, y: 2 }, durationMs: 1255, elapsedMs: 0 },
      facing: 'right',
      rest: [],
    })
  })

  it('距離は出発と着地の差から測る(どちらの座標も0でない組)', () => {
    // 横の差 -1・縦の差 -2 で √5。和で測ると √13 になり 1324ms になる
    expect(planFlight(world, { x: 2, y: 2 }, [{ x: 1, y: 0 }], 0)?.flight.durationMs).toBe(1201)
    // 横の差 -2・縦の差 -1 で √5
    expect(planFlight(world, { x: 2, y: 2 }, [{ x: 0, y: 1 }], 0)?.flight.durationMs).toBe(1201)
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
    durationMs: 1180,
    elapsedMs: 100,
  }

  it('飛ぶ時間に届くまでは経過を足すだけ', () => {
    expect(tickFlight(flight, 16)).toEqual({ landed: false, flight: { ...flight, elapsedMs: 116 } })
    expect(tickFlight(flight, 1079)).toEqual({
      landed: false,
      flight: { ...flight, elapsedMs: 1179 },
    })
  })

  it('ちょうど飛ぶ時間に届いた歩みで着地のマスを返す', () => {
    expect(tickFlight(flight, 1080)).toEqual({ landed: true, cell: { x: 0, y: 0 } })
  })

  it('飛ぶ時間を過ぎた歩みでも着地のマスだけを返し、余りの時間は返さない', () => {
    expect(tickFlight(flight, 1500)).toEqual({ landed: true, cell: { x: 0, y: 0 } })
  })
})

describe('takeOff', () => {
  // (0,0) から (2,1) の水のマス(扉の代わり)へ向かう経路。立てる最後のマス (2,0) まで直線で2マス、1180ms
  const resting: MoveState = {
    cell: { x: 0, y: 0 },
    facing: 'up',
    motion: null,
    route: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
    fast: true,
    fly: true,
    flight: null,
    turnRemainingMs: 0,
    stride: 1,
  }

  it('飛んでよい経路なら許可を使い切って飛び立ち、経路を着地の後にぶつかる1歩だけにする', () => {
    expect(takeOff(world, resting, 37)).toEqual({
      cell: { x: 0, y: 0 },
      facing: 'right',
      motion: null,
      route: [{ x: 2, y: 1 }],
      fast: true,
      fly: false,
      flight: { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, durationMs: 1180, elapsedMs: 37 },
      turnRemainingMs: 0,
      stride: 1,
    })
  })

  it('飛んでよい経路でなければ飛び立たない', () => {
    expect(takeOff(world, { ...resting, fly: false }, 0)).toBeNull()
  })

  it('飛んでよくても、直線で2マスに届かない経路なら飛び立たない', () => {
    expect(takeOff(world, { ...resting, route: [{ x: 1, y: 0 }] }, 0)).toBeNull()
  })
})

describe('advanceFlight', () => {
  const flight: Flight = {
    from: { x: 0, y: 0 },
    to: { x: 2, y: 0 },
    durationMs: 1180,
    elapsedMs: 100,
  }
  // 飛び立った後の状態。経路には着地の後にぶつかる1歩が残っている
  const flying: MoveState = {
    cell: { x: 0, y: 0 },
    facing: 'right',
    motion: null,
    route: [{ x: 2, y: 1 }],
    fast: true,
    fly: false,
    flight,
    turnRemainingMs: 0,
    stride: 1,
  }

  it('飛ぶ時間に届くまでは経過だけを足し、今のマスも残りの経路も変えない', () => {
    expect(advanceFlight(flying, flight, 1079)).toEqual({
      state: {
        cell: { x: 0, y: 0 },
        facing: 'right',
        motion: null,
        route: [{ x: 2, y: 1 }],
        fast: true,
        fly: false,
        flight: { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, durationMs: 1180, elapsedMs: 1179 },
        turnRemainingMs: 0,
        stride: 1,
      },
      landed: null,
    })
  })

  it('着地の歩みで今のマスを着地のマスへ移して飛行を終え、残りの経路はそのまま渡す', () => {
    const landedState: MoveState = {
      cell: { x: 2, y: 0 },
      facing: 'right',
      motion: null,
      route: [{ x: 2, y: 1 }],
      fast: true,
      fly: false,
      flight: null,
      turnRemainingMs: 0,
      stride: 1,
    }
    expect(advanceFlight(flying, flight, 1080)).toEqual({
      state: landedState,
      landed: { x: 2, y: 0 },
    })
    // 飛ぶ時間を大きく過ぎた歩みでも同じ。余りの時間はどこにも持ち越さない
    expect(advanceFlight(flying, flight, 5000)).toEqual({
      state: landedState,
      landed: { x: 2, y: 0 },
    })
  })
})

describe('flightPose', () => {
  const aloft = (facing: Direction, elapsedMs: number): Pick<MoveState, 'flight' | 'facing'> => ({
    facing,
    flight: { from: { x: 0, y: 2 }, to: { x: 2, y: 0 }, durationMs: 1255, elapsedMs },
  })

  it('飛んでいなければ null', () => {
    expect(flightPose({ facing: 'down', flight: null }, false)).toBeNull()
    expect(flightPose({ facing: 'left', flight: null }, true)).toBeNull()
  })

  it.each([
    ['up', 0, 'player-fly-up-0', false],
    ['up', 320, 'player-fly-up-1', false],
    ['down', 0, 'player-fly-down-0', false],
    ['down', 320, 'player-fly-down-1', false],
    ['right', 0, 'player-fly-right-0', false],
    ['right', 320, 'player-fly-right-1', false],
    // 左向きの絵は持たないので右向きを反転する
    ['left', 0, 'player-fly-right-0', true],
    ['left', 320, 'player-fly-right-1', true],
  ] as const)('%s 向きで %s ms なら %s(反転 %s)', (facing, elapsedMs, key, flip) => {
    expect(flightPose(aloft(facing, elapsedMs), false)).toEqual({ key, flip, animating: true })
  })

  it.each([
    ['up', 'player-fly-up-0', false],
    ['down', 'player-fly-down-0', false],
    ['right', 'player-fly-right-0', false],
    ['left', 'player-fly-right-0', true],
  ] as const)('動きを控える設定では %s 向きも最初のコマ %s で止める', (facing, key, flip) => {
    // 位置は時間で動くので、雲の動きを止めても animating のまま
    expect(flightPose(aloft(facing, 320), true)).toEqual({ key, flip, animating: true })
  })
})

describe('isFlying', () => {
  it('飛んでいる間だけ true', () => {
    const flight: Flight = {
      from: { x: 0, y: 2 },
      to: { x: 0, y: 0 },
      durationMs: 1180,
      elapsedMs: 0,
    }
    expect(isFlying({ flight })).toBe(true)
    expect(isFlying({ flight: null })).toBe(false)
  })

  it('歩いている間(motion)は飛んでいると数えない', () => {
    const walking: MoveState = {
      cell: { x: 0, y: 0 },
      facing: 'right',
      motion: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, progress: 0.5 },
      route: [],
      fast: false,
      fly: false,
      flight: null,
      turnRemainingMs: 0,
      stride: 1,
    }
    expect(isFlying(walking)).toBe(false)
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

  it('時間の1/4で進む距離の10.3515625%まで来ている(ゆっくり出発)', () => {
    const position = flightPosition(flying(150))
    expect(position?.x).toBeCloseTo(3.5859375, 12)
    expect(position?.y).toBeCloseTo(11.20703125, 12)
    expect(flightLiftCells(flying(150))).toBeCloseTo(0.84375, 12)
    expect(flightShadow(flying(150))).toBeCloseTo(0.81015625, 12)
  })

  it('時間の1/3ではまだ上昇し、影が小さくなっている', () => {
    const position = flightPosition(flying(200))
    expect(position?.x).toBeCloseTo(256 / 81, 12)
    expect(position?.y).toBeCloseTo(925 / 81, 12)
    expect(flightLiftCells(flying(200))).toBeCloseTo(1024 / 729, 12)
    expect(flightShadow(flying(200))).toBeCloseTo(277 / 405, 12)
  })

  it('時間の半分で50%まで来て、頂点の2マスに達する', () => {
    const position = flightPosition(flying(300))
    expect(position?.x).toBeCloseTo(2, 12)
    expect(position?.y).toBeCloseTo(12, 12)
    expect(flightLiftCells(flying(300))).toBeCloseTo(2, 12)
    expect(flightShadow(flying(300))).toBeCloseTo(0.55, 12)
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
    // 5行目の上限は4マスで、曲線の最も高い2マスより高い(抑えない)
    [5, 4],
    [12, 11],
  ])('地上の縦 %s マスでは %s マスまで浮ける', (groundY, limit) => {
    expect(flightLiftLimit(groundY)).toBe(limit)
  })
})

describe('上の端の近くの浮き上がり', () => {
  // 真上へ8マス、600msで飛んでrow行目へ降りる。地上の縦は五次の加減速で近づく。
  // 曲線の高さは150msで0.84375、200・400msで1024/729、300ms(頂点)で2マス
  const rising = (row: number, elapsedMs: number): { flight: Flight } => ({
    flight: { from: { x: 14, y: row + 8 }, to: { x: 14, y: row }, durationMs: 600, elapsedMs },
  })

  it.each([
    // 上端へは400msで地上136/81、上限55/81に抑える。それまでは曲線の高さのまま
    [0, [0.84375, 1024 / 729, 2, 55 / 81]],
    // 1行目以降へは400msでも上限に届かない
    [1, [0.84375, 1024 / 729, 2, 1024 / 729]],
    [3, [0.84375, 1024 / 729, 2, 1024 / 729]],
    [5, [0.84375, 1024 / 729, 2, 1024 / 729]],
  ] as const)('%s 行目へ降りる飛行の 150・200・300・400ms の浮き上がりは %o', (row, lifts) => {
    const actual = [150, 200, 300, 400].map(at => flightLiftCells(rising(row, at)))
    lifts.forEach((lift, i) => expect(actual[i]).toBeCloseTo(lift, 12))
  })

  it('上端の行へ降りる間も、飛び立ちと着地の瞬間は地上にいる', () => {
    expect(flightLiftCells(rising(0, 0))).toBe(0)
    expect(flightLiftCells(rising(0, 600))).toBe(0)
  })

  it('上限で浮かない所でも負にはならず、影は等倍・カメラも持ち上げない', () => {
    // 450msは地上0.828125行目で、上限の計算は負
    expect(flightLiftCells(rising(0, 450))).toBe(0)
    expect(flightShadow(rising(0, 450))).toBe(1)
    expect(flightCameraLift(rising(0, 450))).toBe(0)
  })

  it('影の倍率とカメラの持ち上げも、上限で抑えた浮き上がりから決める', () => {
    // 400msは55/81マスに抑える。影は61/72、持ち上げはその半分の55/162
    expect(flightShadow(rising(0, 400))).toBeCloseTo(61 / 72, 12)
    expect(flightCameraLift(rising(0, 400))).toBeCloseTo(55 / 162, 12)
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
    // 曲線は1msに最大およそ0.015マス、上限は最大0.025マス変わる。小さい方を取っても切れ目は出ない
    const lifts = Array.from({ length: 601 }, (_, at) => flightLiftCells(rising(row, at)))
    const steps = lifts.slice(1).map((lift, i) => Math.abs(lift - lifts[i]))
    expect(Math.max(...steps)).toBeLessThan(0.05)
  })

  it('上端の行へ降りる飛行でも、途中では最も高い2マス近くまで浮く(飛ぶこと自体は残る)', () => {
    const lifts = Array.from({ length: 601 }, (_, at) => flightLiftCells(rising(0, at)))
    expect(Math.max(...lifts)).toBeCloseTo(2, 12)
  })
})

describe('flightCameraLift', () => {
  // 600ms の飛行。時間の半分(300ms)で最も高い。町の真ん中の高さで、浮き上がりは上限に届かない
  const flying = (elapsedMs: number): { flight: Flight } => ({
    flight: { from: { x: 4, y: 11 }, to: { x: 0, y: 13 }, durationMs: 600, elapsedMs },
  })

  it('飛んでいなければ、また飛び立ちと着地の瞬間はカメラを持ち上げない', () => {
    expect(flightCameraLift({ flight: null })).toBe(0)
    expect(flightCameraLift(flying(0))).toBe(0)
    expect(flightCameraLift(flying(600))).toBe(0)
  })

  it('最も高い時(2マス)に1マス持ち上げる', () => {
    expect(flightCameraLift(flying(300))).toBe(1)
  })

  it('時間の1/4(浮き上がり0.84375マス)では0.421875マス持ち上げる', () => {
    expect(flightCameraLift(flying(150))).toBeCloseTo(0.421875, 12)
  })

  it('最も高い時も、絵の上端と影が枠の真ん中から上下4マス(端から半マスの余白)に収まる', () => {
    const apex = flying(300)
    expect(flightLiftCells(apex)).toBe(FLIGHT_LIFT_CELLS)
    const camera = flightCameraLift(apex)
    // 真ん中からの位置(マス、上が負)。表示枠は縦9マスで、見えるのは上下4.5マス。
    // 絵の上端は、地上のマスの下辺から浮き上がりだけ上にある足の2マス上。影は地上のマスの下辺まで
    const top = camera - FLIGHT_LIFT_CELLS - 1.5
    const shadow = camera + 0.5
    expect(top).toBeGreaterThanOrEqual(-4)
    expect(shadow).toBeLessThanOrEqual(4)
    // 持ち上げない時(上端 -3.5)より頭の上の余白が広い
    expect(top).toBeGreaterThan(-4)
  })
})
