import { afterEach, describe, expect, it, vi } from 'vitest'
import { canObserveIntersection, resolveFullyVisible, shouldRevealAtOnce } from './observe-fallback'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('canObserveIntersection', () => {
  it('IntersectionObserver が無い環境(node)では使えない', () => {
    expect(canObserveIntersection()).toBe(false)
  })

  it('IntersectionObserver がある環境では使える', () => {
    vi.stubGlobal('IntersectionObserver', class {})
    expect(canObserveIntersection()).toBe(true)
  })

  it('あとから消された環境では使えない(読み込み時の有無を覚えない)', () => {
    vi.stubGlobal('IntersectionObserver', class {})
    expect(canObserveIntersection()).toBe(true)
    vi.stubGlobal('IntersectionObserver', undefined)
    expect(canObserveIntersection()).toBe(false)
  })
})

// タプル: [説明, モーション抑制, 観察できるか, 期待値]
const revealCases: Array<[string, boolean, boolean, boolean]> = [
  ['観察できて動きも許すなら、交差を待つ', false, true, false],
  ['観察できない環境では、隠したままにせず最初から出す', false, false, true],
  ['モーション抑制の設定では、観察できても最初から出す', true, true, true],
  ['モーション抑制で観察もできないなら、最初から出す', true, false, true],
]

describe('shouldRevealAtOnce', () => {
  it.each(revealCases)('%s', (_label, prefersReducedMotion, canObserve, expected) => {
    expect(shouldRevealAtOnce(prefersReducedMotion, canObserve)).toBe(expected)
  })
})

// タプル: [説明, 観察できるか, 観察した結果, 期待値]
const fullyVisibleCases: Array<[string, boolean, boolean, boolean]> = [
  ['観察できるなら、丸ごと収まっている結果をそのまま使う', true, true, true],
  ['観察できるなら、縁に掛かっている結果もそのまま使う', true, false, false],
  ['観察できない環境では、灰色に沈めず表示側へ倒す', false, false, true],
  ['観察できない環境では、結果が何であれ表示側へ倒す', false, true, true],
]

describe('resolveFullyVisible', () => {
  it.each(fullyVisibleCases)('%s', (_label, canObserve, observed, expected) => {
    expect(resolveFullyVisible(canObserve, observed)).toBe(expected)
  })
})
