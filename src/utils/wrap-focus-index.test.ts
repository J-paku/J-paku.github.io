// 重ね表示の窓の Tab の輪で端から反対の端へ回すか(wrapFocusIndex)のテスト。
// 要素は文字列で表す(比べるのは同じものかどうかだけなので DOM は要らない)
import { describe, expect, it } from 'vitest'
import { wrapFocusIndex } from './wrap-focus-index'

// 会話窓に見立てた並び。先頭・途中・末尾の 3 つと、並びの外の見出し(lead)
const ITEMS = ['link', 'next', 'close'] as const
const LEAD = 'title'

describe('wrapFocusIndex', () => {
  describe('Tab(次へ)', () => {
    it('末尾では先頭へ回す', () => {
      expect(wrapFocusIndex({ items: ITEMS, active: 'close', lead: LEAD, shift: false })).toBe(0)
    })

    // 末尾以外はブラウザの既定の Tab に任せる。先頭も回さない(Shift の向きと取り違えると落ちる)
    it.each(['link', 'next'])('%s では回さない', active => {
      expect(wrapFocusIndex({ items: ITEMS, active, lead: LEAD, shift: false })).toBeNull()
    })

    // 見出しを先頭と同じに扱うのは Shift+Tab の時だけ
    it('見出しでは回さない', () => {
      expect(wrapFocusIndex({ items: ITEMS, active: LEAD, lead: LEAD, shift: false })).toBeNull()
    })
  })

  describe('Shift+Tab(前へ)', () => {
    it('先頭では末尾へ回す', () => {
      expect(wrapFocusIndex({ items: ITEMS, active: 'link', lead: LEAD, shift: true })).toBe(2)
    })

    it('見出し(lead)では末尾へ回す', () => {
      expect(wrapFocusIndex({ items: ITEMS, active: LEAD, lead: LEAD, shift: true })).toBe(2)
    })

    // 先頭と見出し以外はブラウザの既定に任せる。末尾も回さない(Tab の向きと取り違えると落ちる)
    it.each(['next', 'close'])('%s では回さない', active => {
      expect(wrapFocusIndex({ items: ITEMS, active, lead: LEAD, shift: true })).toBeNull()
    })

    // lead を渡さない窓(地図・卓上時計)は、焦点が並びの外(null)にあっても回さない
    it('lead の無い窓で焦点が並びの外なら回さない', () => {
      expect(wrapFocusIndex({ items: ITEMS, active: null, shift: true })).toBeNull()
    })

    // lead を渡した窓で、その要素がまだ無い(null)時は焦点が無い状態と同じに扱う
    it('lead が null で焦点も無ければ末尾へ回す', () => {
      expect(wrapFocusIndex({ items: ITEMS, active: null, lead: null, shift: true })).toBe(2)
    })
  })

  // 1 つだけの並びは先頭と末尾が同じ。どちらの向きでもその 1 つへ戻す
  it.each([false, true])('1 つだけの並びは shift=%s でも 0 へ回す', shift => {
    expect(wrapFocusIndex({ items: ['close'], active: 'close', shift })).toBe(0)
  })

  // 空の並びでは回す先が無い。焦点が見出しにあっても末尾(-1)を返さない
  it.each([false, true])('空の並びは shift=%s でも回さない', shift => {
    expect(wrapFocusIndex({ items: [], active: LEAD, lead: LEAD, shift })).toBeNull()
  })
})
