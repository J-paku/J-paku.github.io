// スプライト素材の寸法と生成結果を検証する
import { describe, expect, it } from 'vitest'
import { TILE, validateArt } from './art'
import { PLAYER_HEIGHT } from './actors'
import { palette } from './palette'
import { buildPlayerSprites, buildSprites, PLAYER_ARTS, SPRITE_ARTS } from './sprites'

describe('SPRITE_ARTS', () => {
  it('地形・建物はすべて十六行十六列である', () => {
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
    expect(sheet.height).toBe(TILE)
  })

  it('目印の背景が透明である', () => {
    expect(SPRITE_ARTS.marker.join('')).toContain('.')
  })
})

describe('PLAYER_ARTS', () => {
  it('主人公はすべて二十四行十六列である', () => {
    for (const art of Object.values(PLAYER_ARTS)) {
      expect(art).toHaveLength(PLAYER_HEIGHT)
      for (const row of art) expect(row).toHaveLength(16)
    }
  })

  it('すべて登録済みの色だけを使う', () => {
    for (const [key, art] of Object.entries(PLAYER_ARTS)) {
      expect(validateArt(art, palette, TILE, PLAYER_HEIGHT), key).toEqual([])
    }
  })

  it('主人公のシートは高さ 24 の別シートになる', () => {
    const sheet = buildPlayerSprites()

    expect(sheet.uri.startsWith('data:image/png;base64,')).toBe(true)
    expect(sheet.count).toBe(Object.keys(PLAYER_ARTS).length)
    expect(sheet.height).toBe(PLAYER_HEIGHT)
  })

  it('静止コマは足元がマスの下辺(最終行)に着き、頭上 4 行は空である', () => {
    for (const key of ['player-up-0', 'player-down-0', 'player-right-0'] as const) {
      const art = PLAYER_ARTS[key]
      expect(art.slice(0, 4).join('')).toBe('.'.repeat(64))
      expect(art[PLAYER_HEIGHT - 1]).toMatch(/x/)
    }
  })

  it('主人公の静止コマと歩行コマが異なる', () => {
    expect(PLAYER_ARTS['player-up-0']).not.toEqual(PLAYER_ARTS['player-up-1'])
    expect(PLAYER_ARTS['player-down-0']).not.toEqual(PLAYER_ARTS['player-down-1'])
    expect(PLAYER_ARTS['player-right-0']).not.toEqual(PLAYER_ARTS['player-right-1'])
  })

  it('軸足が変わっても頭部と胴のドットは変わらない', () => {
    for (const direction of ['up', 'down'] as const) {
      const first = PLAYER_ARTS[`player-${direction}-1`]
      const second = PLAYER_ARTS[`player-${direction}-2`]
      expect(first.slice(0, -1)).toEqual(second.slice(0, -1))
      expect(first.at(-1)).not.toEqual(second.at(-1))
    }
  })

  it('横向きは反転してもずれないよう 1〜14 列に収まる', () => {
    for (const key of ['player-right-0', 'player-right-1'] as const) {
      for (const row of PLAYER_ARTS[key]) {
        expect(row[0]).toBe('.')
        expect(row[15]).toBe('.')
      }
    }
  })

  it('主人公の背景が透明である', () => {
    for (const art of Object.values(PLAYER_ARTS)) expect(art.join('')).toContain('.')
  })
})
