// 机上時計の状態の移り方(set-clock-time)のテスト。ストアの set と同じ浅い合成をスプレッドで写し、
// 初期値・実時刻へ戻す・時刻を決める の3つの操作の後の状態と、そこから決まる昼夜の段階を見る
import { describe, expect, it } from 'vitest'
import {
  customClockTime,
  initialClockTime,
  realtimeClockTime,
  type ClockTime,
} from './set-clock-time'
import { villagePhase } from './village-phase'

// UTC03:00 = JST12:00。実時刻を見ているなら day になる時刻
const noonJst = new Date(Date.UTC(2026, 8, 20, 3))

// zustand の set と同じ浅い合成。返さなかった欄は前の値のまま残る
const apply = (state: ClockTime, patch: Partial<ClockTime>): ClockTime => ({ ...state, ...patch })

describe('initialClockTime', () => {
  it('初期値は実時刻で、時刻は未設定', () => {
    expect(initialClockTime()).toEqual({
      timeMode: 'realtime',
      customHour: null,
      customMinute: null,
    })
  })

  it('時刻を決めた後に合成すると初期値へ戻る', () => {
    const state = apply(customClockTime(20, 30), initialClockTime())

    expect(state).toEqual({ timeMode: 'realtime', customHour: null, customMinute: null })
  })
})

describe('customClockTime', () => {
  it('(20, 0) で custom へ移り、段階は night になる', () => {
    const state = apply(initialClockTime(), customClockTime(20, 0))

    expect(state).toEqual({ timeMode: 'custom', customHour: 20, customMinute: 0 })
    // 実時刻は昼だが、机上時計の20時が勝つ
    expect(villagePhase(state, noonJst)).toBe('night')
  })

  it.each([
    ['24時以上は一周させる', 25, 70, 1, 10],
    ['負の値も一周させる', -3, -10, 21, 50],
    ['ちょうど24時・60分は0へ丸める', 24, 60, 0, 0],
  ] as const)('%s', (_label, hour, minute, expectedHour, expectedMinute) => {
    const state = customClockTime(hour, minute)

    expect(state.customHour).toBe(expectedHour)
    expect(state.customMinute).toBe(expectedMinute)
  })

  // 方針を決めた記録ではなく、いまの動作をそのまま固定する単言。
  // NaN は剰余の丸めを素通りして NaN のまま入り、段階はどのしきい値にも当たらず night になる。
  // 時計 UI は数値しか渡さないので現状は表に出ないが、動作が変わったらここで気付ける
  it('(NaN, NaN) は NaN のまま入り、段階は night になる(現在動作の固定)', () => {
    const state = customClockTime(Number.NaN, Number.NaN)

    expect(state.timeMode).toBe('custom')
    expect(state.customHour).toBeNaN()
    expect(state.customMinute).toBeNaN()
    expect(villagePhase(state, noonJst)).toBe('night')
  })
})

describe('realtimeClockTime', () => {
  it('モードだけを返し、時・分の欄を持たない', () => {
    expect(realtimeClockTime()).toEqual({ timeMode: 'realtime' })
  })

  it('時刻を決めた後に合成すると実時刻へ戻り、段階は now から決まる', () => {
    const state = apply(customClockTime(20, 0), realtimeClockTime())

    expect(state.timeMode).toBe('realtime')
    // 針の位置は残す(戻したときに跳ねないように)が、段階の判定には使わない
    expect(state.customHour).toBe(20)
    expect(state.customMinute).toBe(0)
    expect(villagePhase(state, noonJst)).toBe('day')
  })
})
