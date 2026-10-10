// 焼いたシートの使い回し sheetOf と、指紋入りのファイル名 sheetFileName のテスト
import { vi } from 'vitest'
import { buildPlayerSprites, buildSprites } from './sprites'

// sheetOf は焼いた 1 枚をモジュール変数に覚える。テストごとに読み込み直し、空の覚えから始める
const freshSheetFile = async () => {
  vi.resetModules()
  return import('./sheet-file')
}

describe('sheetOf', () => {
  it('初めて聞かれた組は焼いたシートを返し、同じ組をもう一度聞くと同じ実体を返す', async () => {
    const { sheetOf } = await freshSheetFile()
    const first = sheetOf('sprite', 'day')
    expect(first).toEqual(buildSprites('day'))
    expect(sheetOf('sprite', 'day')).toBe(first)
  })
  it('種類・段階が違う組は、それぞれの焼き方で別に焼く', async () => {
    const { sheetOf } = await freshSheetFile()
    expect(sheetOf('player', 'night')).toEqual(buildPlayerSprites('night'))
    expect(sheetOf('player', 'dusk')).toEqual(buildPlayerSprites('dusk'))
    expect(sheetOf('sprite', 'night')).toEqual(buildSprites('night'))
  })
})

describe('sheetFileName', () => {
  it('種類・段階・中身の指紋(16 進 8 桁)で名前を作り、中身が違えば指紋も違う', async () => {
    const { sheetFileName } = await freshSheetFile()
    const day = sheetFileName('sprite', 'day')
    const night = sheetFileName('sprite', 'night')
    expect(day).toMatch(/^sprite-day-[0-9a-f]{8}\.png$/)
    expect(night).toMatch(/^sprite-night-[0-9a-f]{8}\.png$/)
    expect(day.slice(-12)).not.toBe(night.slice(-12))
  })
})
