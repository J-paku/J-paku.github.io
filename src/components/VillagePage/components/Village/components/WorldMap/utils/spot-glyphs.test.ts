// 拡大地図の印のドット絵(CHECK_GLYPH・QUESTION_GLYPH)と下敷きの大きさPLATE_CELLSのテスト
import { describe, expect, it } from 'vitest'
import { CHECK_GLYPH, PLATE_CELLS, QUESTION_GLYPH } from './spot-glyphs'

// 字の列(左から数えて何番目)を上から下へ縦に読む
const column = (glyph: readonly string[], x: number): string => glyph.map(row => row[x]).join('')

describe('CHECK_GLYPH・QUESTION_GLYPH', () => {
  it.each([
    ['CHECK_GLYPH', CHECK_GLYPH],
    ['QUESTION_GLYPH', QUESTION_GLYPH],
  ])('%sは7×7で、「.」と「#」だけで描く', (_name, glyph) => {
    expect(glyph).toHaveLength(7)
    for (const row of glyph) expect(row).toMatch(/^[.#]{7}$/)
  })

  it('「?」は左右の端の列を空け、下敷きの黒い縁と繋げない', () => {
    expect(column(QUESTION_GLYPH, 0)).toBe('.......')
    expect(column(QUESTION_GLYPH, 6)).toBe('.......')
  })

  it('「?」の点は1行空けて棒から離す', () => {
    expect(QUESTION_GLYPH[5]).toBe('.......')
    expect(QUESTION_GLYPH[6]).toContain('#')
    expect(QUESTION_GLYPH[4]).toContain('#')
  })

  it('✓と?は別の形', () => {
    expect(CHECK_GLYPH).not.toEqual(QUESTION_GLYPH)
  })
})

describe('PLATE_CELLS', () => {
  it('字の周りを1ドットずつ広げた9ドット角', () => {
    expect(PLATE_CELLS).toBe(9)
    expect(PLATE_CELLS).toBe(CHECK_GLYPH.length + 2)
  })
})
