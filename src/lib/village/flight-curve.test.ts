// 直線飛行の数値・境界・減速と離着陸・雲の時間表を検査する
import {
  FLIGHT_LIFT_CELLS,
  FLIGHT_MIN_DISTANCE,
  flightDurationMs,
  flightEase,
  flightLift,
  flightShadowScale,
  flightFrame,
} from './flight-curve'

describe('飛行の定数', () => {
  it('屋根を越える高さと、1マスを歩く距離の境界を固定する', () => {
    expect(FLIGHT_LIFT_CELLS).toBeCloseTo(2, 12)
    expect(FLIGHT_MIN_DISTANCE).toBe(2)
  })
})

describe('flightDurationMs', () => {
  it.each([
    [-100, 1000],
    [-0.001, 1000],
    [0, 1000],
    [0.0055, 1000],
    [0.0056, 1001],
    [1, 1090],
    [1.999, 1180],
    [2, 1180],
    [2.001, 1180],
    [2.0055, 1180],
    [2.0056, 1181],
    [Math.sqrt(8), 1255],
    [3, 1270],
    [3.125, 1281],
    [5, 1450],
    [8, 1720],
    [15, 2350],
    [20, 2800],
    [22.21, 2999],
    [22.216, 2999],
    [22.217, 3000],
    [200 / 9, 3000],
    [22.23, 3000],
    [36, 3000],
    [1000, 3000],
  ])('距離 %s マスの時間は %s msになる', (distance, expected) => {
    expect(flightDurationMs(distance)).toBe(expected)
  })

  it('小数の距離でも整数msを返し、距離が伸びても時間は短くならない', () => {
    let previous = flightDurationMs(0)
    for (let i = 1; i <= 4000; i += 1) {
      const duration = flightDurationMs(i / 100)
      expect(Number.isInteger(duration)).toBe(true)
      expect(duration).toBeGreaterThanOrEqual(previous)
      expect(duration).toBeGreaterThanOrEqual(1000)
      expect(duration).toBeLessThanOrEqual(3000)
      previous = duration
    }
  })
})

describe('flightEase', () => {
  it.each([
    [-10, 0],
    [-0.001, 0],
    [0, 0],
    [1, 1],
    [1.001, 1],
    [10, 1],
  ])('経過比率 %s を端の進行率 %s に収める', (t, expected) => {
    expect(flightEase(t)).toBe(expected)
  })

  it.each([
    [0.001, 0.000000009985006],
    [0.1, 0.00856],
    [0.25, 0.103515625],
    [0.5, 0.5],
    [0.75, 0.896484375],
    [0.9, 0.99144],
    [0.999, 0.999999990014994],
  ])('経過比率 %s の進行率は %s になる', (t, expected) => {
    expect(flightEase(t)).toBeCloseTo(expected, 12)
  })

  it('全区間で前進し、前半で加速して後半で減速し続ける', () => {
    let previous = flightEase(0)
    let previousDelta = 0
    for (let i = 1; i <= 100; i += 1) {
      const progress = flightEase(i / 100)
      const delta = progress - previous
      expect(progress).toBeGreaterThan(previous)
      expect(progress).toBeLessThanOrEqual(1)
      if (i <= 50) expect(delta).toBeGreaterThan(previousDelta)
      if (i > 51) expect(delta).toBeLessThan(previousDelta)
      previous = progress
      previousDelta = delta
    }
  })

  it('前半と後半で半分ずつ進み、離着陸の水平速度と加速度が0に近づく', () => {
    expect(flightEase(0.5) - flightEase(0)).toBe(0.5)
    expect(flightEase(1) - flightEase(0.5)).toBe(0.5)
    const firstSpeed = (flightEase(0.001) - flightEase(0)) / 0.001
    const lastSpeed = (flightEase(1) - flightEase(0.999)) / 0.001
    expect(firstSpeed).toBeCloseTo(0.000009985006, 10)
    expect(lastSpeed).toBeCloseTo(0.000009985006, 10)
    for (const h of [0.001, 0.0001]) {
      const firstAcceleration = (flightEase(2 * h) - 2 * flightEase(h)) / h ** 2
      const lastAcceleration =
        (flightEase(1) - 2 * flightEase(1 - h) + flightEase(1 - 2 * h)) / h ** 2
      expect(Math.abs(firstAcceleration)).toBeLessThan(60 * h)
      expect(Math.abs(lastAcceleration)).toBeLessThan(60 * h)
    }
  })

  it('中央の1/3で街を通り、最後の1/4は進み続けながらゆっくり止まる', () => {
    const first = flightEase(1 / 3)
    const middle = flightEase(2 / 3) - first
    const last = 1 - flightEase(2 / 3)
    expect(first).toBeCloseTo(17 / 81, 12)
    expect(last).toBeCloseTo(17 / 81, 12)
    expect(middle).toBeCloseTo(47 / 81, 12)
    expect(middle).toBeGreaterThan(first * 2.5)
    expect(middle).toBeGreaterThan(last * 2.5)
    expect(1 - flightEase(0.75)).toBeCloseTo(0.103515625, 12)
    expect(1 - flightEase(0.9)).toBeCloseTo(0.00856, 12)
  })
})

describe('flightLift', () => {
  it.each([-10, -0.001, 0, 1, 1.001, 10])('経過比率 %s では地上にいる', t => {
    expect(flightLift(t)).toBe(0)
  })

  it.each([
    [0.001, 0.000000063808191936],
    [0.1, 0.046656],
    [0.25, 0.421875],
    [0.5, 1],
    [0.75, 0.421875],
    [0.9, 0.046656],
    [0.999, 0.000000063808191936],
  ])('経過比率 %s の高さの比率は %s になる', (t, expected) => {
    expect(flightLift(t)).toBeCloseTo(expected, 12)
  })

  it('時間の半分で正確に頂点へ達し、丸め誤差でも1を超えない', () => {
    expect(flightLift(0.5)).toBe(1)
    expect(flightLift(0.499)).toBeCloseTo(0.9999880000479999, 12)
    expect(flightLift(0.501)).toBeCloseTo(0.9999880000479999, 12)
  })

  it('地面より下へ行かず、頂点まで上がってから地上まで下がる', () => {
    for (let i = 0; i <= 1000; i += 1) {
      const lift = flightLift(i / 1000)
      expect(lift).toBeGreaterThanOrEqual(0)
      expect(lift).toBeLessThanOrEqual(1)
    }
    let previous = flightLift(0)
    for (let i = 1; i <= 100; i += 1) {
      const lift = flightLift(i / 200)
      expect(lift).toBeGreaterThan(previous)
      previous = lift
    }
    for (let i = 1; i <= 100; i += 1) {
      const lift = flightLift(0.5 + i / 200)
      expect(lift).toBeLessThan(previous)
      previous = lift
    }
  })

  it('着地直前の降下量を小さくし、最後に地上へ跳ねない', () => {
    const before = flightLift(0.998) - flightLift(0.999)
    const last = flightLift(0.999) - flightLift(1)
    expect(before).toBeCloseTo(0.000000445125947968, 12)
    expect(last).toBeCloseTo(0.000000063808191936, 12)
    expect(last).toBeLessThan(before)
  })

  it('離着陸の鉛直速度と加速度が0へ近づき、最後の1/4は降下速度が減り続ける', () => {
    const h = 0.0001
    expect(flightLift(h) / h).toBeLessThan(0.000001)
    expect(flightLift(1 - h) / h).toBeLessThan(0.000001)
    expect((flightLift(2 * h) - 2 * flightLift(h)) / h ** 2).toBeLessThan(0.04)
    expect((flightLift(1 - 2 * h) - 2 * flightLift(1 - h)) / h ** 2).toBeLessThan(0.04)
    let previousDrop = 1
    for (let i = 76; i <= 100; i += 1) {
      const drop = flightLift((i - 1) / 100) - flightLift(i / 100)
      expect(drop).toBeGreaterThan(0)
      expect(drop).toBeLessThan(previousDrop)
      previousDrop = drop
    }
    expect(flightLift(0.75) * FLIGHT_LIFT_CELLS).toBeCloseTo(0.84375, 12)
    expect(flightLift(0.9) * FLIGHT_LIFT_CELLS).toBeCloseTo(0.093312, 12)
  })
})

describe('flightShadowScale', () => {
  it.each([
    [-10, 1],
    [-0.001, 1],
    [0, 1],
    [0.1, 0.955],
    [0.25, 0.8875],
    [0.5, 0.775],
    [0.75, 0.6625],
    [0.9, 0.595],
    [1, 0.55],
    [1.001, 0.55],
    [10, 0.55],
  ])('高さの比率 %s の影は %s 倍になる', (lift, expected) => {
    expect(flightShadowScale(lift)).toBeCloseTo(expected, 12)
  })

  it('高いほど小さくなり、頂点でも影を残す', () => {
    let previous = flightShadowScale(0)
    for (let i = 1; i <= 100; i += 1) {
      const scale = flightShadowScale(i / 100)
      expect(scale).toBeLessThan(previous)
      expect(scale).toBeGreaterThanOrEqual(0.55)
      expect(scale).toBeGreaterThan(0)
      previous = scale
    }
  })
})

describe('flightFrame', () => {
  it.each([
    [-641, 0],
    [-320, 0],
    [-0.001, 0],
    [0, 0],
    [1, 0],
    [160, 0],
    [319, 0],
    [319.999, 0],
    [320, 1],
    [320.001, 1],
    [480, 1],
    [639, 1],
    [639.999, 1],
    [640, 0],
    [640.001, 0],
    [959.999, 0],
    [960, 1],
    [1279.999, 1],
    [1280, 0],
    [3519.999, 0],
    [3520, 1],
    [3839.999, 1],
    [3840, 0],
    [1000000319.999, 0],
    [1000000320, 1],
    [1000000640, 0],
  ])('%s msでコマ %s を出す', (elapsedMs, expected) => {
    expect(flightFrame(elapsedMs)).toBe(expected)
  })

  it('640ms周期で同じコマを繰り返す', () => {
    for (let elapsedMs = 0; elapsedMs < 3000; elapsedMs += 1) {
      expect(flightFrame(elapsedMs + 640)).toBe(flightFrame(elapsedMs))
      expect(flightFrame(elapsedMs + 320)).toBe(1 - flightFrame(elapsedMs))
    }
  })
})
