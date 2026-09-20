// スプライト素材の寸法と生成結果を検証する
import { describe, expect, it } from 'vitest'
import { recolor, TILE, validateArt } from './art'
import type { PixelArt } from './art'
import { PLAYER_HEIGHT } from './actors'
import { palette } from './palette'
import { buildPlayerSprites, buildSprites, PLAYER_ARTS, SPRITE_ARTS } from './sprites'
import type { SpriteKey } from './sprites'

// 複数マスに跨る素材を 1 枚の下絵へ戻す。行優先で並べたキーを受け取る
const stitch = (keys: readonly SpriteKey[], columns: number): PixelArt => {
  const rows: string[] = []
  for (let row = 0; row * columns < keys.length; row += 1) {
    for (let y = 0; y < TILE; y += 1) {
      let line = ''
      for (let col = 0; col < columns; col += 1) line += SPRITE_ARTS[keys[row * columns + col]][y]
      rows.push(line)
    }
  }
  return rows
}

const charsOf = (art: PixelArt): Set<string> => new Set(art.join(''))

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

  it('経歴碑 2×2 は 32×32 の 1 枚に戻り、下辺が輪郭で接地する', () => {
    const art = stitch(['monument-tl', 'monument-tr', 'monument-bl', 'monument-br'], 2)

    expect(art).toHaveLength(TILE * 2)
    for (const row of art) expect(row).toHaveLength(TILE * 2)
    expect(art[art.length - 1]).toBe(`.${'x'.repeat(TILE * 2 - 2)}.`)
  })

  it('縦長の碑 1×2 は 16×32 の 1 枚に戻る', () => {
    const art = stitch(['stele-t', 'stele-b'], 1)

    expect(art).toHaveLength(TILE * 2)
    expect(art[art.length - 1]).toBe('x'.repeat(TILE))
  })

  it('机 3×2 は床の色を塗らず透明で抜く', () => {
    const art = stitch(['desk-tl', 'desk-tm', 'desk-tr', 'desk-bl', 'desk-bm', 'desk-br'], 3)

    expect(art).toHaveLength(TILE * 2)
    for (const row of art) expect(row).toHaveLength(TILE * 3)
    // 'p' は部屋の床タイルの色。構造物側で塗ると床の模様が消える
    expect(charsOf(art).has('p')).toBe(false)
    expect(charsOf(art).has('.')).toBe(true)
  })

  it('屋根は赤 2 色と輪郭だけで描かれ、軒だけが木の色を持つ', () => {
    for (const key of ['roof-red-l', 'roof-red-m', 'roof-red-r'] as const) {
      expect([...charsOf(SPRITE_ARTS[key])].sort().join(''), key).toMatch(/^\.?Rrx$/)
    }
    for (const key of ['roof-red-l-low', 'roof-red-m-low', 'roof-red-r-low'] as const) {
      expect([...charsOf(SPRITE_ARTS[key])].sort().join(''), key).toBe('Rekrx')
    }
  })

  it('青い屋根は赤い屋根の色置換で作れる', () => {
    for (const side of ['l', 'm', 'r'] as const) {
      for (const suffix of ['', '-low'] as const) {
        const red = SPRITE_ARTS[`roof-red-${side}${suffix}`]
        const blue = SPRITE_ARTS[`roof-blue-${side}${suffix}`]
        expect(recolor(red, { r: 'u', R: 'U' }), `${side}${suffix}`).toEqual(blue)
      }
    }
  })

  it('壁・窓・扉は同じ位置に柱を持ち、横に並べても継ぎ目が揃う', () => {
    const post = SPRITE_ARTS['wall-m'].map(row => row.slice(0, 4))

    for (const key of ['wall-l', 'wall-r', 'window', 'door', 'entrance-l'] as const) {
      expect(
        SPRITE_ARTS[key].map(row => row.slice(0, 4)),
        key
      ).toEqual(post)
    }
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
