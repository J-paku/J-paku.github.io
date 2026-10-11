// 縦スクロールの位置を自前の縦棒の割合に直す(measureScrollThumb)のテスト
import { describe, expect, it } from 'vitest'
import { HIDDEN_THUMB, measureScrollThumb } from './measure-scroll-thumb'

describe('HIDDEN_THUMB', () => {
  it('棒を出さず、つまみはトラックいっぱい', () => {
    expect(HIDDEN_THUMB).toStrictEqual({ visible: false, top: 0, size: 1 })
  })
})

describe('measureScrollThumb', () => {
  describe('収まっている', () => {
    // 毎回同じ値を返す(state に入れた時に再レンダーを起こさない)ので、中身ではなく同じものかを見る
    it('中身と窓が同じ高さなら棒を出さない', () => {
      const thumb = measureScrollThumb({ scrollTop: 0, scrollHeight: 100, clientHeight: 100 })
      expect(thumb).toBe(HIDDEN_THUMB)
    })

    // 差が 1px ちょうどまでは収まっているとみなす(< と取り違える・遊びを引く壊れ方がここで落ちる)
    it('中身が 1px だけ高くても棒を出さない', () => {
      const thumb = measureScrollThumb({ scrollTop: 0, scrollHeight: 101, clientHeight: 100 })
      expect(thumb).toBe(HIDDEN_THUMB)
    })
  })

  describe('あふれている', () => {
    it('中身が 2px 高ければ棒を出す', () => {
      expect(
        measureScrollThumb({ scrollTop: 0, scrollHeight: 102, clientHeight: 100 })
      ).toStrictEqual({ visible: true, top: 0, size: 100 / 102 })
    })

    // 窓 100・中身 400 なら、つまみは 1/4。送れる 300px のうち 150px 送れば、残り 3/4 の半分
    it('つまみの長さは窓と中身の比、位置は送った割合', () => {
      expect(
        measureScrollThumb({ scrollTop: 150, scrollHeight: 400, clientHeight: 100 })
      ).toStrictEqual({ visible: true, top: 0.375, size: 0.25 })
    })

    it('下端まで送るとつまみの下端がトラックの下端に着く', () => {
      expect(
        measureScrollThumb({ scrollTop: 300, scrollHeight: 400, clientHeight: 100 })
      ).toStrictEqual({ visible: true, top: 0.75, size: 0.25 })
    })
  })

  describe('つまみの長さの下限', () => {
    // 窓と中身の比が 0.05 でも、つまみは 0.08 より短くしない。位置は残りの 0.92 の中で動く
    it('比が下限より小さければ下限の長さにする', () => {
      const thumb = measureScrollThumb({ scrollTop: 950, scrollHeight: 2000, clientHeight: 100 })
      expect(thumb.visible).toBe(true)
      expect(thumb.size).toBe(0.08)
      expect(thumb.top).toBeCloseTo(0.46, 10)
    })

    // 比が下限ちょうどなら、そのまま使う
    it('比が下限ちょうどならその長さ', () => {
      const thumb = measureScrollThumb({ scrollTop: 0, scrollHeight: 100, clientHeight: 8 })
      expect(thumb).toStrictEqual({ visible: true, top: 0, size: 0.08 })
    })
  })
})
