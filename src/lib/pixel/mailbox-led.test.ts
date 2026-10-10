// ポストの LED を置く生成器(mailboxWithLeds)のテスト。実際のポストの絵(structures.ts)は読まず、
// 置き換わったマスが一目で分かる一色の下絵で、粒の位置・色と元の絵を書き換えないことを見る。
// structures.ts を読まないのは、生成器が読み込みの時点で投げる壊れ方をしても、このファイルは
// 読み込みで落ちずに it の中で失敗として数えるため
import { describe, expect, it } from 'vitest'
import type { PixelArt } from './art'
import { mailboxWithLeds } from './mailbox-led'

// 16×16 を同じ文字で埋めた下絵。粒の入るマスだけがこの文字から変わる
const plain = (): PixelArt => Array.from({ length: 16 }, () => 'x'.repeat(16))

// 下絵と違うマスを「行,列,文字」で並べる
const changedCells = (before: PixelArt, after: PixelArt): string[] =>
  after.flatMap((row, y) =>
    [...row].flatMap((ch, x) => (ch === before[y][x] ? [] : [`${y},${x},${ch}`]))
  )

describe('mailboxWithLeds', () => {
  it('消灯では前面の上辺(6行目)の1マス飛ばし5か所だけを赤・緑・青の通常色のレンズにする', () => {
    const art = plain()
    expect(changedCells(art, mailboxWithLeds(art, false))).toEqual([
      '6,3,R',
      '6,5,G',
      '6,7,U',
      '6,9,R',
      '6,11,G',
    ])
  })

  it('点灯では同じ5か所を赤・緑・紫の光源文字にする', () => {
    const art = plain()
    expect(changedCells(art, mailboxWithLeds(art, true))).toEqual([
      '6,3,+',
      '6,5,*',
      '6,7,#',
      '6,9,+',
      '6,11,*',
    ])
  })

  it('行数と各行の長さは下絵のまま', () => {
    const art = plain()
    const lit = mailboxWithLeds(art, true)
    expect(lit).toHaveLength(art.length)
    expect(lit.map(row => row.length)).toEqual(art.map(row => row.length))
  })

  it('下絵は書き換えず、新しい絵を返す', () => {
    const art = plain()
    const before = [...art]
    const lit = mailboxWithLeds(art, true)
    expect(art).toEqual(before)
    expect(lit).not.toBe(art)
  })
})
