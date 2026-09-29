// 卓上時計の窓が使う時刻の刻みと表記(clock-time)のテスト
import { describe, expect, it } from 'vitest'
import { formatClock, HOUR_SPAN, MINUTE_SPAN, MINUTE_STEP, pad2 } from './clock-time'

describe('時刻の刻み', () => {
  it('時は24、分は60で一周し、分は10分刻み', () => {
    expect(HOUR_SPAN).toBe(24)
    expect(MINUTE_SPAN).toBe(60)
    expect(MINUTE_STEP).toBe(10)
  })

  // 刻みで一周を割り切れないと、巡回するうちに00・10・…・50から外れた分へ落ちる
  it('10分刻みで一周すると00から50までの6段だけを巡る', () => {
    expect(MINUTE_SPAN % MINUTE_STEP).toBe(0)
    const steps = Array.from({ length: MINUTE_SPAN / MINUTE_STEP }, (_, i) => pad2(i * MINUTE_STEP))
    expect(steps).toEqual(['00', '10', '20', '30', '40', '50'])
  })
})

describe('pad2', () => {
  // 1桁と2桁の境目(9と10)を対で並べる。0詰めの桁数がずれたらどちらかが落ちる
  it.each([
    [0, '00'],
    [5, '05'],
    [9, '09'],
    [10, '10'],
    [23, '23'],
    [59, '59'],
  ] as const)('%iは%sになる', (value, expected) => {
    expect(pad2(value)).toBe(expected)
  })
})

describe('formatClock', () => {
  it.each([
    [0, 0, '00:00'],
    [9, 5, '09:05'],
    [18, 0, '18:00'],
    [23, 50, '23:50'],
  ] as const)('%i時%i分は%s', (hour, minute, expected) => {
    expect(formatClock(hour, minute)).toBe(expected)
  })

  // 時と分が同じ値だと取り違えても気付けないので、違う値で並びを確かめる
  it('時が前・分が後ろに並ぶ', () => {
    expect(formatClock(7, 30)).toBe('07:30')
  })
})
