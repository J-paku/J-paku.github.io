import { beforeEach, describe, expect, it } from 'vitest'
import { useVillageTime, villagePhase } from './use-village-time'

// ストアは module 単位で1つなので、テスト同士が前のテストの時刻を引き継がないよう毎回戻す
beforeEach(() => {
  useVillageTime.getState().resetTimeState()
})

// UTC03:00 = JST12:00。実時刻を見ているなら day になる時刻
const noonJst = new Date(Date.UTC(2026, 8, 20, 3))

describe('useVillageTime', () => {
  it('初期値は実時刻で、時刻は未設定', () => {
    const state = useVillageTime.getState()
    expect(state.timeMode).toBe('realtime')
    expect(state.customHour).toBeNull()
    expect(state.customMinute).toBeNull()
  })

  it('setCustomTime(20, 0) で custom へ移り、段階は night になる', () => {
    useVillageTime.getState().setCustomTime(20, 0)

    const state = useVillageTime.getState()
    expect(state.timeMode).toBe('custom')
    expect(state.customHour).toBe(20)
    expect(state.customMinute).toBe(0)
    // 実時刻は昼だが、机上時計の20時が勝つ
    expect(villagePhase(state, noonJst)).toBe('night')
  })

  it('setRealtime で実時刻へ戻り、段階は now から決まる', () => {
    useVillageTime.getState().setCustomTime(20, 0)
    useVillageTime.getState().setRealtime()

    const state = useVillageTime.getState()
    expect(state.timeMode).toBe('realtime')
    // 針の位置は残す(戻したときに跳ねないように)が、段階の判定には使わない
    expect(state.customHour).toBe(20)
    expect(villagePhase(state, noonJst)).toBe('day')
  })

  it('resetTimeState で初期値へ戻る', () => {
    useVillageTime.getState().setCustomTime(20, 30)
    useVillageTime.getState().resetTimeState()

    const state = useVillageTime.getState()
    expect(state.timeMode).toBe('realtime')
    expect(state.customHour).toBeNull()
    expect(state.customMinute).toBeNull()
  })

  it.each([
    ['24時以上は一周させる', 25, 70, 1, 10],
    ['負の値も一周させる', -3, -10, 21, 50],
    ['ちょうど24時・60分は0へ丸める', 24, 60, 0, 0],
  ] as const)('%s', (_label, hour, minute, expectedHour, expectedMinute) => {
    useVillageTime.getState().setCustomTime(hour, minute)

    const state = useVillageTime.getState()
    expect(state.customHour).toBe(expectedHour)
    expect(state.customMinute).toBe(expectedMinute)
  })
})

describe('villagePhase', () => {
  it('custom でも時刻が未設定なら実時刻へ落とす', () => {
    // UI が時刻を入れる前にモードだけ切り替えた状態を setState で直接作る
    useVillageTime.setState({ timeMode: 'custom', customHour: null, customMinute: null })

    expect(villagePhase(useVillageTime.getState(), noonJst)).toBe('day')
  })

  it('custom の時刻はしきい値どおりに段階へ変わる', () => {
    useVillageTime.getState().setCustomTime(5, 0)
    expect(villagePhase(useVillageTime.getState(), noonJst)).toBe('dawn')

    useVillageTime.getState().setCustomTime(17, 0)
    expect(villagePhase(useVillageTime.getState(), noonJst)).toBe('dusk')
  })
})
