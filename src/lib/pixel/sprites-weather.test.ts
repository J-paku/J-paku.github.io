// 雨と雪のシートを検証する。1 コマ 1 枚であること、2 コマが平行移動でつながること
import { describe, expect, it } from 'vitest'
import { TILE } from './art'
import { buildWeatherSprites } from './sprites'
import { charsOf, decode, shift } from './sprites.fixture'
import { weatherArt } from './weather-art'

describe('天気のシート', () => {
  it('雨・雪ともコマごとに 16×16 ちょうどの 1 枚を返す', () => {
    const sheets = buildWeatherSprites()

    for (const kind of ['rain', 'snow'] as const) {
      expect(sheets[kind], kind).toHaveLength(2)
      for (const sheet of sheets[kind]) {
        const image = decode(sheet.uri)
        expect(sheet.count, kind).toBe(1)
        expect(sheet.height, kind).toBe(TILE)
        // 繰り返し単位が 1 マスちょうどであること。2 コマを 1 枚へ並べると単位が 2 マス幅になり、
        // コマ送りが「落ちる」ではなく「横へ 1 マスずれる」動きになってしまう
        expect([image.width, image.height], kind).toEqual([TILE, TILE])
      }
    }
  })

  it('2 コマは中身が違う', () => {
    const sheets = buildWeatherSprites()

    for (const kind of ['rain', 'snow'] as const) {
      const [first, second] = sheets[kind]
      expect(first.uri, kind).not.toBe(second.uri)
      expect(weatherArt[kind][0], kind).not.toEqual(weatherArt[kind][1])
    }
  })

  it('雪は主人公専用のモノクロを借りず、雪専用の文字だけで描く', () => {
    for (const art of weatherArt.snow) {
      const used = charsOf(art)
      // '3'・'1' は主人公専用。借りると主人公を塗り替えたとき雪の色まで黙って変わる
      expect(used.has('3')).toBe(false)
      expect(used.has('1')).toBe(false)
      expect(used.has('N') || used.has('O')).toBe(true)
    }
  })

  it('2 コマ目は 1 コマ目を半マス分ずらしたものなので、端で絵がつながる', () => {
    expect(weatherArt.rain[1]).toEqual(shift(weatherArt.rain[0], -4, 8))
    expect(weatherArt.snow[1]).toEqual(shift(weatherArt.snow[0], 1, 8))
  })

  it('粒はまばらで、地面を覆い隠さない', () => {
    for (const kind of ['rain', 'snow'] as const) {
      for (const art of weatherArt[kind]) {
        const lit = art.join('').replace(/\./g, '').length
        expect(lit, kind).toBeGreaterThan(0)
        expect(lit, kind).toBeLessThan(TILE * TILE * 0.1)
      }
    }
  })
})
