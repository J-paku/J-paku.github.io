import { describe, expect, it } from 'vitest'
import { dayPhaseAt, dayPhaseAtHour } from './day-phase'

// UTC時刻(時・分)から2026-09-20のDateを作る。日付自体は判定に影響しない
const utc = (hour: number, minute = 0): Date => new Date(Date.UTC(2026, 8, 20, hour, minute))

describe('dayPhaseAt', () => {
  it.each([
    ['境界 JST05:00 → dawn', 20, 'dawn'],
    ['境界 JST07:00 → day', 22, 'day'],
    ['境界 JST17:00 → dusk', 8, 'dusk'],
    ['境界 JST19:00 → night', 10, 'night'],
    ['帯の内側 JST06:00 → dawn', 21, 'dawn'],
    ['帯の内側 JST12:00 → day', 3, 'day'],
    ['帯の内側 JST18:00 → dusk', 9, 'dusk'],
    ['帯の内側 JST22:00 → night', 13, 'night'],
  ] as const)('%s', (_label, utcHour, expected) => {
    expect(dayPhaseAt(utc(utcHour))).toBe(expected)
  })

  it('日付をまたぐ深夜(UTC15:00 = JST00:00)はnight', () => {
    expect(dayPhaseAt(utc(15))).toBe('night')
  })
})

describe('dayPhaseAtHour', () => {
  // しきい値の前後を対で並べる。境界の等号(以上・未満)がずれたらどちらかが落ちる
  it.each([
    [4, 'night'],
    [5, 'dawn'],
    [6, 'dawn'],
    [7, 'day'],
    [16, 'day'],
    [17, 'dusk'],
    [18, 'dusk'],
    [19, 'night'],
    [23, 'night'],
    [0, 'night'],
  ] as const)('%i時 → %s', (hour, expected) => {
    expect(dayPhaseAtHour(hour)).toBe(expected)
  })
})
