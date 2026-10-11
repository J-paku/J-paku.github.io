// 吹き出しを村の枠の左右へ押し戻す量(shiftBubble)と、書いてある --shift の読み取り(readShift)のテスト。
// 枠は原点から離した位置に置く(左端が 0 だと、余白を足すか引くかの取り違えが同じ値になって見抜けない)
import { describe, expect, it } from 'vitest'
import { FRAME_PADDING, readShift, shiftBubble } from './shift-bubble'
import type { HorizontalSpan } from './shift-bubble'

// 枠の左右と、余白を引いた内側の端
const FRAME = { left: 100, right: 500 }
const INNER_LEFT = FRAME.left + FRAME_PADDING
const INNER_RIGHT = FRAME.right - FRAME_PADDING

// ブラウザが --shift を当てた後に測れる箱。transform で横へずれるので左右とも同じだけ動く
const moved = (span: HorizontalSpan, shift: number): HorizontalSpan => ({
  left: span.left + shift,
  right: span.right + shift,
})

describe('shiftBubble', () => {
  // 収まっている時は 0。toBe は -0 と 0 を見分けるので、右の判定が境目で負の 0 を返す壊れ方も落ちる
  it('内側に収まっていれば押し戻さない', () => {
    expect(shiftBubble(FRAME, { left: 200, right: 300 }, 0)).toBe(0)
  })

  describe('左へはみ出す', () => {
    it('はみ出した分だけ右へ押す', () => {
      expect(shiftBubble(FRAME, { left: 90, right: 250 }, 0)).toBe(18)
    })

    it('内側の端を 1px 越えれば 1px 押す', () => {
      expect(shiftBubble(FRAME, { left: INNER_LEFT - 1, right: 250 }, 0)).toBe(1)
    })

    // 左端ちょうどは、はみ出していない。右がはみ出していればそちらを押し戻す(>= と取り違えると 0 になる)
    it('内側の端ちょうどなら左では押さず右を見る', () => {
      expect(shiftBubble(FRAME, { left: INNER_LEFT, right: INNER_RIGHT + 8 }, 0)).toBe(-8)
    })
  })

  describe('右へはみ出す', () => {
    it('はみ出した分だけ左へ押す', () => {
      expect(shiftBubble(FRAME, { left: 300, right: 510 }, 0)).toBe(-18)
    })

    it('内側の端を 1px 越えれば 1px 戻す', () => {
      expect(shiftBubble(FRAME, { left: 300, right: INNER_RIGHT + 1 }, 0)).toBe(-1)
    })

    it('内側の端ちょうどなら押さない', () => {
      expect(shiftBubble(FRAME, { left: 300, right: INNER_RIGHT }, 0)).toBe(0)
    })
  })

  // 枠より広く両側へはみ出す時は左の分を押し戻す
  it('両側へはみ出せば左を優先する', () => {
    expect(shiftBubble(FRAME, { left: 90, right: 510 }, 0)).toBe(18)
  })

  // 吹き出しは出た直後と少し後に測り直す。2 回目に測る箱には 1 回目に書いた量が既に乗っているので、
  // それを引かずに測ると「はみ出していない」と見て 0 へ戻し、吹き出しが枠の外へ戻ってしまう
  describe('押し戻した後に測り直す', () => {
    it('左へ押した後に測り直しても同じ量を返す', () => {
      const natural = { left: 90, right: 250 }
      const first = shiftBubble(FRAME, natural, 0)
      expect(first).toBe(18)
      expect(shiftBubble(FRAME, moved(natural, first), first)).toBe(first)
    })

    it('右へ戻した後に測り直しても同じ量を返す', () => {
      const natural = { left: 300, right: 510 }
      const first = shiftBubble(FRAME, natural, 0)
      expect(first).toBe(-18)
      expect(shiftBubble(FRAME, moved(natural, first), first)).toBe(first)
    })

    // カメラが動いて押し戻す前の位置が枠に収まるようになったら、書いてある量を外して 0 へ戻す
    it('押し戻す前の位置が収まっていれば 0 へ戻す', () => {
      expect(shiftBubble(FRAME, moved({ left: 200, right: 300 }, 18), 18)).toBe(0)
    })

    // 左へ押していた吹き出しが、押し戻す前の位置では右へはみ出すようになれば、右の分で測り直す
    it('左へ押していた後に右へはみ出せば左へ戻す', () => {
      expect(shiftBubble(FRAME, moved({ left: 300, right: 510 }, 18), 18)).toBe(-18)
    })
  })
})

describe('readShift', () => {
  it.each([
    ['18px', 18],
    ['-12.5px', -12.5],
    ['0px', 0],
  ] as const)('%s は %d', (value, expected) => {
    expect(readShift(value)).toBe(expected)
  })

  // まだ一度も書いていない要素は空の文字列を返す。数にならないので押し戻していない(0)とみなす
  it('空なら 0', () => {
    expect(readShift('')).toBe(0)
  })
})
