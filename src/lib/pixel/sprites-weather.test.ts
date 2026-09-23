// 雨と雪のシートを検証する。1 コマ 1 枚であること、2 コマが平行移動でつながること、
// 時間帯で色が変わらないこと
import { describe, expect, it } from 'vitest'
import { TILE } from './art'
import { buildWeatherSprites } from './sprites'
import { charsOf, decode, shift } from './sprites.fixture'
import { weatherArt } from './weather-art'

// 焼き上がった粒の色。雨は明るい筋(v)と暗い筋(n)、雪は十字の雪片(N)と粉雪(O)で、
// 値は palette.ts からの書き写し。palette を import して比べると、天気を phasePalette へ
// 通す変更にも期待値が一緒に動いてしまい「時間帯で変えない」を検査できなくなる
const DAY_COLORS: Record<'rain' | 'snow', readonly string[]> = {
  rain: ['#78c0e8', '#a0d0f8'],
  snow: ['#e5e5e5', '#fafafa'],
}

// 透明でないドットの色を重複なく昇順で返す
const litColors = (uri: string): string[] => {
  const image = decode(uri)
  const colors = new Set<string>()
  for (let at = 0; at < image.data.length; at += 4) {
    if (image.data[at + 3] === 0) continue
    colors.add(`#${[0, 1, 2].map(i => image.data[at + i].toString(16).padStart(2, '0')).join('')}`)
  }
  return [...colors].sort()
}

// 透明でないドットの数
const litCount = (uri: string): number => {
  const image = decode(uri)
  let count = 0
  for (let at = 0; at < image.data.length; at += 4) {
    if (image.data[at + 3] !== 0) count += 1
  }
  return count
}

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

  // AGENTS.md の掟「雨と雪のシートは時間帯で色を変えない」の見張り。寸法だけを見ていると
  // weatherSheet を phasePalette(palette, 'night') で焼くよう変えても素通りし、
  // 夜だけ雪が青黒く沈んでいることに単体テストが一切気付けない
  it('降る粒は時間帯で色を変えず、昼のパレットの色のまま焼かれる', () => {
    const sheets = buildWeatherSprites()

    for (const kind of ['rain', 'snow'] as const) {
      sheets[kind].forEach((sheet, frame) => {
        // 期待色は空でないので、1 粒も点いていなければ色の比較だけでも落ちる。点灯数を先に見るのは、
        // そのとき色の食い違いではなく「何も描かれていない」と分かる形で落とすため
        expect(litCount(sheet.uri), `${kind}-${frame}`).toBeGreaterThan(0)
        expect(litColors(sheet.uri), `${kind}-${frame}`).toEqual(DAY_COLORS[kind])
      })
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
