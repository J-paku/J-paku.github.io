import { beforeEach, describe, expect, it } from 'vitest'
import { useVillageTime } from './use-village-time'
import { villagePhase } from '../utils/village-phase'

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

  // 方針を決めた記録ではなく、いまの動作をそのまま固定する単言。
  // NaN は剰余の丸めを素通りして NaN のまま入り、段階はどのしきい値にも当たらず night になる。
  // 時計 UI は数値しか渡さないので現状は表に出ないが、動作が変わったらここで気付ける
  it('setCustomTime(NaN) は NaN のまま入り、段階は night になる(現在動作の固定)', () => {
    useVillageTime.getState().setCustomTime(Number.NaN, Number.NaN)

    const state = useVillageTime.getState()
    expect(state.timeMode).toBe('custom')
    expect(state.customHour).toBeNaN()
    expect(state.customMinute).toBeNaN()
    expect(villagePhase(state, noonJst)).toBe('night')
  })
})
