// スプライト素材の寸法と生成結果を検証する
import { describe, expect, it } from 'vitest'
import { TILE, validateArt } from './art'
import { palette } from './palette'
import { buildSprites, SPRITE_ARTS } from './sprites'

describe('SPRITE_ARTS', () => {
  it('すべて十六行十六列である', () => {
    for (const art of Object.values(SPRITE_ARTS)) {
      expect(art).toHaveLength(16)
      for (const row of art) expect(row).toHaveLength(16)
    }
  })

  it('すべて登録済みの色だけを使う', () => {
    for (const [key, art] of Object.entries(SPRITE_ARTS)) {
      expect(validateArt(art, palette, TILE), key).toEqual([])
    }
  })

  it('全素材をデータURIのシートへ変換する', () => {
    const sheet = buildSprites()

    expect(sheet.uri.startsWith('data:image/png;base64,')).toBe(true)
    expect(sheet.count).toBe(Object.keys(SPRITE_ARTS).length)
  })

  it('主人公の静止コマと歩行コマが異なる', () => {
    expect(SPRITE_ARTS['player-up-0']).not.toEqual(SPRITE_ARTS['player-up-1'])
    expect(SPRITE_ARTS['player-down-0']).not.toEqual(SPRITE_ARTS['player-down-1'])
    expect(SPRITE_ARTS['player-right-0']).not.toEqual(SPRITE_ARTS['player-right-1'])
  })

  it('軸足が変わっても頭部のドットは変わらない', () => {
    for (const direction of ['up', 'down'] as const) {
      const first = SPRITE_ARTS[`player-${direction}-1`]
      const second = SPRITE_ARTS[`player-${direction}-2`]
      expect(first.slice(0, 10)).toEqual(second.slice(0, 10))
      expect(first.slice(10)).not.toEqual(second.slice(10))
    }
  })

  it('主人公と目印の背景が透明である', () => {
    const transparentKeys = [
      'player-up-0',
      'player-up-1',
      'player-down-0',
      'player-down-1',
      'player-right-0',
      'player-right-1',
      'marker',
    ] as const

    for (const key of transparentKeys) expect(SPRITE_ARTS[key].join('')).toContain('.')
  })
})
