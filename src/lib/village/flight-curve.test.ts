// 直線飛行の数値・境界・減速と離着陸・羽ばたきの時間表を検査する
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
    expect(FLIGHT_LIFT_CELLS).toBeCloseTo(2.5, 12)
    expect(FLIGHT_MIN_DISTANCE).toBe(2)
  })
})

describe('flightDurationMs', () => {
  it.each([
    [-100, 480],
    [-0.001, 480],
    [0, 480],
    [0.015, 480],
    [0.015625, 481],
    [1, 512],
    [1.999, 544],
    [2, 544],
    [2.001, 544],
    [2.015, 544],
    [2.015625, 545],
    [Math.sqrt(8), 571],
    [3.125, 580],
    [5, 640],
    [15, 960],
    [29.96875, 1439],
    [29.984375, 1440],
    [30, 1440],
    [30.03125, 1440],
    [36, 1440],
    [1000, 1440],
  ])('距離 %s マスの時間は %s msになる', (distance, expected) => {
    expect(flightDurationMs(distance)).toBe(expected)
  })

  it('小数の距離でも整数msを返し、距離が伸びても時間は短くならない', () => {
    let previous = flightDurationMs(0)
    for (let i = 1; i <= 4000; i += 1) {
      const duration = flightDurationMs(i / 100)
      expect(Number.isInteger(duration)).toBe(true)
      expect(duration).toBeGreaterThanOrEqual(previous)
      expect(duration).toBeGreaterThanOrEqual(480)
      expect(duration).toBeLessThanOrEqual(1440)
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
    [0.001, 0.002997001],
    [0.1, 0.271],
    [0.25, 0.578125],
    [0.5, 0.875],
    [0.75, 0.984375],
    [0.9, 0.999],
    [0.999, 0.999999999],
  ])('経過比率 %s の進行率は %s になる', (t, expected) => {
    expect(flightEase(t)).toBeCloseTo(expected, 12)
  })

  it('全区間で前進し、等しい時間ごとの移動量が減り続ける', () => {
    let previous = flightEase(0)
    let previousDelta = 1
    for (let i = 1; i <= 100; i += 1) {
      const progress = flightEase(i / 100)
      const delta = progress - previous
      expect(progress).toBeGreaterThan(previous)
      expect(progress).toBeLessThanOrEqual(1)
      expect(delta).toBeLessThan(previousDelta)
      previous = progress
      previousDelta = delta
    }
  })

  it('前半で87.5%を進み、着地直前の速度は0に近づく', () => {
    const firstHalf = flightEase(0.5) - flightEase(0)
    const lastHalf = flightEase(1) - flightEase(0.5)
    expect(firstHalf).toBeCloseTo(0.875, 12)
    expect(lastHalf).toBeCloseTo(0.125, 12)
    expect(firstHalf).toBeGreaterThan(lastHalf)
    expect((flightEase(1) - flightEase(0.999)) / 0.001).toBeCloseTo(0.000001, 10)
  })
})

describe('flightLift', () => {
  it.each([-10, -0.001, 0, 1, 1.001, 10])('経過比率 %s では地上にいる', t => {
    expect(flightLift(t)).toBe(0)
  })

  it.each([
    [0.001, 0.00673650675],
    [0.1, 0.54675],
    [0.25, 0.94921875],
    [0.5, 0.84375],
    [0.75, 0.31640625],
    [0.9, 0.06075],
    [0.999, 0.00000674325],
  ])('経過比率 %s の高さの比率は %s になる', (t, expected) => {
    expect(flightLift(t)).toBeCloseTo(expected, 12)
  })

  it('時間の1/3で正確に頂点へ達し、丸め誤差でも1を超えない', () => {
    expect(flightLift(1 / 3)).toBe(1)
    expect(flightLift(1 / 3 - 0.001)).toBeCloseTo(0.99999324325, 12)
    expect(flightLift(1 / 3 + 0.001)).toBeCloseTo(0.99999325675, 12)
  })

  it('地面より下へ行かず、頂点まで上がってから地上まで下がる', () => {
    for (let i = 0; i <= 1000; i += 1) {
      const lift = flightLift(i / 1000)
      expect(lift).toBeGreaterThanOrEqual(0)
      expect(lift).toBeLessThanOrEqual(1)
    }
    let previous = flightLift(0)
    for (let i = 1; i <= 100; i += 1) {
      const lift = flightLift(i / 300)
      expect(lift).toBeGreaterThan(previous)
      previous = lift
    }
    for (let i = 1; i <= 100; i += 1) {
      const lift = flightLift(1 / 3 + (2 * i) / 300)
      expect(lift).toBeLessThan(previous)
      previous = lift
    }
  })

  it('着地直前の降下量を小さくし、最後に地上へ跳ねない', () => {
    const before = flightLift(0.998) - flightLift(0.999)
    const last = flightLift(0.999) - flightLift(1)
    expect(before).toBeCloseTo(0.00002020275, 12)
    expect(last).toBeCloseTo(0.00000674325, 12)
    expect(last).toBeLessThan(before)
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
    [-241, 0],
    [-120, 0],
    [-0.001, 0],
    [0, 0],
    [1, 0],
    [60, 0],
    [119, 0],
    [119.999, 0],
    [120, 1],
    [120.001, 1],
    [180, 1],
    [239, 1],
    [239.999, 1],
    [240, 0],
    [240.001, 0],
    [359.999, 0],
    [360, 1],
    [479.999, 1],
    [480, 0],
    [1319.999, 0],
    [1320, 1],
    [1439.999, 1],
    [1440, 0],
    [1000000079.999, 1],
    [1000000080, 0],
    [1000000200, 1],
  ])('%s msでコマ %s を出す', (elapsedMs, expected) => {
    expect(flightFrame(elapsedMs)).toBe(expected)
  })

  it('240ms周期で同じコマを繰り返す', () => {
    for (let elapsedMs = 0; elapsedMs < 1440; elapsedMs += 1) {
      expect(flightFrame(elapsedMs + 240)).toBe(flightFrame(elapsedMs))
      expect(flightFrame(elapsedMs + 120)).toBe(1 - flightFrame(elapsedMs))
    }
  })
})
