// 机上時計の状態から昼夜の段階を決める villagePhase のテスト。
// 受け取るのは timeMode と customHour だけの普通のオブジェクトなので、ストアを通さずにその場で作る
import { describe, expect, it } from 'vitest'
import { villagePhase } from './village-phase'

// UTC03:00 = JST12:00。実時刻を見ているなら day になる時刻
const noonJst = new Date(Date.UTC(2026, 8, 20, 3))

describe('villagePhase', () => {
  it('custom でも時刻が未設定なら実時刻へ落とす', () => {
    // UI が時刻を入れる前にモードだけ切り替えた状態
    expect(villagePhase({ timeMode: 'custom', customHour: null }, noonJst)).toBe('day')
  })

  // 0時は「24時→0」の丸めで実際に踏む値。未設定(null)と 0 を混同する判定
  // (customHour !== null を真偽値判定に替える等)だと、ここだけ実時刻の day へ落ちる
  it('真夜中(0時)も机上時計の時刻として扱う(未設定と混同しない)', () => {
    expect(villagePhase({ timeMode: 'custom', customHour: 0 }, noonJst)).toBe('night')
  })

  // 上の 0時は期待値が night なので、custom の時刻を段階へ渡す部分が定数 night でも、
  // 時刻が1時間ずれていても落ちない。しきい値ちょうどの 5時・17時で night 以外の段階を確かめる
  it('custom の時刻はしきい値どおりに段階へ変わる', () => {
    expect(villagePhase({ timeMode: 'custom', customHour: 5 }, noonJst)).toBe('dawn')
    expect(villagePhase({ timeMode: 'custom', customHour: 17 }, noonJst)).toBe('dusk')
  })
})
