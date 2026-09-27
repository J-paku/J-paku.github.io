// 机上時計の状態から昼夜の段階を決める villagePhase のテスト
import { beforeEach, describe, expect, it } from 'vitest'
import { useVillageTime } from '../hooks/use-village-time'
import { villagePhase } from './village-phase'

// ストアは module 単位で1つなので、テスト同士が前のテストの時刻を引き継がないよう毎回戻す
beforeEach(() => {
  useVillageTime.getState().resetTimeState()
})

// UTC03:00 = JST12:00。実時刻を見ているなら day になる時刻
const noonJst = new Date(Date.UTC(2026, 8, 20, 3))

describe('villagePhase', () => {
  it('custom でも時刻が未設定なら実時刻へ落とす', () => {
    // UI が時刻を入れる前にモードだけ切り替えた状態を setState で直接作る
    useVillageTime.setState({ timeMode: 'custom', customHour: null, customMinute: null })

    expect(villagePhase(useVillageTime.getState(), noonJst)).toBe('day')
  })

  // 0時は「24時→0」の丸めで実際に踏む値。未設定(null)と 0 を混同する判定
  // (customHour !== null を真偽値判定に替える等)だと、ここだけ実時刻の day へ落ちる
  it('真夜中(0時)も机上時計の時刻として扱う(未設定と混同しない)', () => {
    useVillageTime.getState().setCustomTime(0, 0)

    const state = useVillageTime.getState()
    expect(state.customHour).toBe(0)
    expect(villagePhase(state, noonJst)).toBe('night')
  })

  it('custom の時刻はしきい値どおりに段階へ変わる', () => {
    useVillageTime.getState().setCustomTime(5, 0)
    expect(villagePhase(useVillageTime.getState(), noonJst)).toBe('dawn')

    useVillageTime.getState().setCustomTime(17, 0)
    expect(villagePhase(useVillageTime.getState(), noonJst)).toBe('dusk')
  })
})
