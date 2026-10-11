// 主人公のコマを組み立てる合成の部品(compose-player.ts)のテスト。
// 絵のデータ(actors.ts)は使わず、行ごとに文字を変えた小さな行列で、どの行・列がどこへ動くかを固める
import { describe, expect, it } from 'vitest'
import type { PixelArt } from './art'
import {
  alternateFoot,
  framed2,
  framed3,
  mirrorArt,
  moveHead,
  overlayPose,
  overlayRod,
  partAt,
  PLAYER_BODY_LEFT,
  PLAYER_BODY_TOP,
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
  PLAYER_HEIGHT,
  pose,
  stand,
  toFrame,
  walk,
} from './compose-player'

// 体の幅(16)の空行と、画布の幅(32)の空行。blanks は空行を n 行並べる
const BLANK = '.'.repeat(16)
const FRAME_BLANK = '.'.repeat(32)
const blanks = (n: number): string[] => Array.from({ length: n }, () => BLANK)

// y 行目の文字(0 行目が A、23 行目が X)
const letter = (y: number): string => String.fromCharCode(65 + y)
// 頭の行(4〜16 行)は右端の 1 列を透明にし、重ねたときに下の絵が透けるかを見る。ほかの行は幅いっぱいに描く
const headRow = (y: number): string => letter(y).repeat(15) + '.'
const bodyRow = (y: number): string => letter(y).repeat(16)
const figure: PixelArt = Array.from({ length: 24 }, (_, y) =>
  y >= 4 && y <= 16 ? headRow(y) : bodyRow(y)
)

describe('コマの寸法', () => {
  it('体は16×24、画布は32×32で、体は左右8列・上8行の余白の下辺中央に立つ', () => {
    expect([PLAYER_HEIGHT, PLAYER_BODY_LEFT, PLAYER_BODY_TOP]).toEqual([24, 8, 8])
    expect([PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT]).toEqual([32, 32])
  })
})

describe('stand と walk', () => {
  it('静止は頭上に空行を4行置き、体と足をそのまま続ける', () => {
    expect(stand(['b0', 'b1'], ['f0', 'f1'])).toEqual([...blanks(4), 'b0', 'b1', 'f0', 'f1'])
  })
  it('歩行は空行を5行置いて一段下げ、足は1行だけ続ける', () => {
    expect(walk(['b0', 'b1'], 'f')).toEqual([...blanks(5), 'b0', 'b1', 'f'])
  })
})

describe('mirrorArt と alternateFoot', () => {
  it('行の 0〜14 列だけを左右に反転し、15 列目から先はそのまま残す', () => {
    expect(mirrorArt('abcdefghijklmnoP')).toBe('onmlkjihgfedcbaP')
    expect(mirrorArt('abcdefghijklmnoPQ')).toBe('onmlkjihgfedcbaPQ')
  })
  it('軸足の交代は最下行だけを反転し、ほかの行は触らない', () => {
    const feet = alternateFoot(['r0', 'r1', 'abcdefghijklmnoP'])
    expect(feet).toEqual(['r0', 'r1', 'onmlkjihgfedcbaP'])
  })
})

describe('overlayRod', () => {
  it('型紙の . は元の絵を残し、それ以外の文字で塗り替える', () => {
    expect(overlayRod(['ab', 'cd'], ['.X', 'Y.'])).toEqual(['aX', 'Yd'])
  })
})

describe('moveHead', () => {
  it('頭(4〜16行)を下げると、空いた行は空になり、首から下へはみ出した頭は透明な所で下の絵を残す', () => {
    expect(moveHead(figure, 2)).toEqual([
      ...[0, 1, 2, 3].map(bodyRow),
      ...blanks(2),
      ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(headRow),
      letter(15).repeat(15) + letter(17),
      letter(16).repeat(15) + letter(18),
      ...[19, 20, 21, 22, 23].map(bodyRow),
    ])
  })
  it('頭を上げると、頭の上の行へ重なり、頭の下に空いた行は空になる', () => {
    expect(moveHead(figure, -1)).toEqual([
      ...[0, 1, 2].map(bodyRow),
      letter(4).repeat(15) + letter(3),
      ...[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(headRow),
      BLANK,
      ...[17, 18, 19, 20, 21, 22, 23].map(bodyRow),
    ])
  })
  it('ずらさなければ元の絵のまま', () => {
    expect(moveHead(figure, 0)).toEqual(figure)
  })
})

describe('overlayPose と partAt', () => {
  it('型紙の . は元の絵を残し、- は透明へ戻し、それ以外の文字で塗り替える', () => {
    expect(overlayPose(['abc', 'def'], ['.-Z', 'Y..'])).toEqual(['a.Z', 'Yef'])
  })
  it('行番号 → 行 の表を24行へ広げ、表に無い行は空行にする', () => {
    expect(partAt({ 1: 'X', 23: 'Y' })).toEqual(
      Array.from({ length: 24 }, (_, y) => (y === 1 ? 'X' : y === 23 ? 'Y' : BLANK))
    )
  })
})

describe('pose', () => {
  it('頭をずらしてから、型紙を渡した順に重ねる(後の型紙が前の型紙を塗り替える)', () => {
    const base = Array.from({ length: 24 }, (_, y) => (y === 4 ? bodyRow(4) : BLANK))
    const first = partAt({ 0: 'MM' + '.'.repeat(14) })
    const second = partAt({ 0: 'N-' + '.'.repeat(14) })
    expect(pose(base, 1, first, second)).toEqual(
      Array.from({ length: 24 }, (_, y) =>
        y === 0 ? 'N' + '.'.repeat(15) : y === 5 ? bodyRow(4) : BLANK
      )
    )
  })
})

describe('toFrame と framed', () => {
  it('上に画布の幅の空行を8行足し、各行の左右に8列ずつ余白を足す', () => {
    expect(toFrame(['ab'])).toEqual([...Array(8).fill(FRAME_BLANK), '........ab........'])
  })
  it('3コマ・2コマの組を、並びを変えずにそれぞれ画布へ置く', () => {
    expect(framed3([['a'], ['b'], ['c']])).toEqual([toFrame(['a']), toFrame(['b']), toFrame(['c'])])
    expect(framed2([['a'], ['b']])).toEqual([toFrame(['a']), toFrame(['b'])])
  })
})
