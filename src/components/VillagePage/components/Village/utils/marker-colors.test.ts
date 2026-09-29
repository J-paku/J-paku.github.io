// 地図の印の色(MARKER_COLORS)のテスト。
// 訪問済みの緑が地図の草と紛れないこと、白い下敷きの上で字が見えること、
// CSSへ書き写した拡大地図の緑(番号の札・一覧の✓)と黒(訪問前の番号の札)が同じ値のままであることを見る
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MINI_COLORS } from '../components/MapSvg/utils/map-colors'
import { MARKER_COLORS } from './marker-colors'

// WCAG 2の相対輝度。#rgbと#rrggbbの両方を読む
const channel = (value: number): number => {
  const s = value / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = (hex: string): number => {
  const digits = hex.slice(1)
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map(d => d + d)
          .join('')
      : digits
  const [r, g, b] = [0, 2, 4].map(i => channel(parseInt(full.slice(i, i + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// 拡大地図のCSS。CSSはTSの定数を読めないので、緑と黒の値を書き写している
const worldMapCss = readFileSync(
  new URL('../components/WorldMap/world-map.module.css', import.meta.url),
  'utf8'
)
// セレクタ1つ分の宣言ブロックの中身を返す。行頭から探し、`.spot > .badge {`を`.badge`と取り違えない
const blockOf = (selector: string): string => {
  const start = worldMapCss.indexOf(`\n${selector} {`)
  if (start === -1) throw new Error(`world-map.module.cssに${selector}が無い`)
  return worldMapCss.slice(start, worldMapCss.indexOf('}', start))
}

describe('MARKER_COLORS', () => {
  it('色の読み取りの検算(白の輝度は1・黒は0、白と黒の対比は21)', () => {
    expect(luminance('#fff')).toBeCloseTo(1, 10)
    expect(luminance('#000000')).toBe(0)
    expect(contrast('#000', '#ffffff')).toBeCloseTo(21, 10)
  })

  it('訪問済みの緑は地図の草より暗い(草の上の点が紛れない)', () => {
    expect(luminance(MARKER_COLORS.visited)).toBeLessThan(luminance(MINI_COLORS.grass))
    expect(luminance(MARKER_COLORS.visited)).toBeLessThan(luminance(MINI_COLORS['grass-alt']))
  })

  it('訪問済みと未訪問は別の色', () => {
    expect(MARKER_COLORS.visited).not.toBe(MARKER_COLORS.unvisited)
  })

  it('白い下敷きの上の✓・?の字と縁は、図形の対比3:1以上で見える', () => {
    // WCAG 1.4.11(文字以外の対比)の下限。訪問済みの緑は約3.45:1で、少し明るくすると割り込む
    expect(contrast(MARKER_COLORS.visited, MARKER_COLORS.plate)).toBeGreaterThanOrEqual(3)
    expect(contrast(MARKER_COLORS.unvisited, MARKER_COLORS.plate)).toBeGreaterThanOrEqual(3)
    expect(contrast(MARKER_COLORS.plateEdge, MARKER_COLORS.plate)).toBeGreaterThanOrEqual(3)
  })

  it('拡大地図の訪問済みの番号の札は同じ緑を背景に使う', () => {
    expect(blockOf(`.badge[data-visited='true']`)).toContain(`background: ${MARKER_COLORS.visited}`)
  })

  it('拡大地図の一覧の✓も同じ緑で描く', () => {
    expect(blockOf('.legendCheck')).toContain(`color: ${MARKER_COLORS.visited}`)
  })

  it('拡大地図の訪問前の番号の札は?の字と同じ黒を地と縁に使う', () => {
    const badge = blockOf('.badge')
    expect(badge).toContain(`background: ${MARKER_COLORS.unvisited}`)
    expect(badge).toContain(`border: 2px solid ${MARKER_COLORS.unvisited}`)
  })
})
