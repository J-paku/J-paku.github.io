// 吹き出しを村の枠の左右へ押し戻す量(shiftBubble)のテスト。
// 枠は原点から離した位置に置く(左端が 0 だと、余白を足すか引くかの取り違えが同じ値になって見抜けない)
import { describe, expect, it } from 'vitest'
import { FRAME_PADDING, shiftBubble } from './shift-bubble'

// 枠の左右と、余白を引いた内側の端
const FRAME = { left: 100, right: 500 }
const INNER_LEFT = FRAME.left + FRAME_PADDING
const INNER_RIGHT = FRAME.right - FRAME_PADDING

describe('shiftBubble', () => {
  // 収まっている時は 0。toBe は -0 と 0 を見分けるので、右の判定が境目で負の 0 を返す壊れ方も落ちる
  it('内側に収まっていれば押し戻さない', () => {
    expect(shiftBubble(FRAME, { left: 200, right: 300 })).toBe(0)
  })

  describe('左へはみ出す', () => {
    it('はみ出した分だけ右へ押す', () => {
      expect(shiftBubble(FRAME, { left: 90, right: 250 })).toBe(18)
    })

    it('内側の端を 1px 越えれば 1px 押す', () => {
      expect(shiftBubble(FRAME, { left: INNER_LEFT - 1, right: 250 })).toBe(1)
    })

    // 左端ちょうどは、はみ出していない。右がはみ出していればそちらを押し戻す(>= と取り違えると 0 になる)
    it('内側の端ちょうどなら左では押さず右を見る', () => {
      expect(shiftBubble(FRAME, { left: INNER_LEFT, right: INNER_RIGHT + 8 })).toBe(-8)
    })
  })

  describe('右へはみ出す', () => {
    it('はみ出した分だけ左へ押す', () => {
      expect(shiftBubble(FRAME, { left: 300, right: 510 })).toBe(-18)
    })

    it('内側の端を 1px 越えれば 1px 戻す', () => {
      expect(shiftBubble(FRAME, { left: 300, right: INNER_RIGHT + 1 })).toBe(-1)
    })

    it('内側の端ちょうどなら押さない', () => {
      expect(shiftBubble(FRAME, { left: 300, right: INNER_RIGHT })).toBe(0)
    })
  })

  // 枠より広く両側へはみ出す時は左の分を押し戻す
  it('両側へはみ出せば左を優先する', () => {
    expect(shiftBubble(FRAME, { left: 90, right: 510 })).toBe(18)
  })
})
