// jsdomにはdocument.startViewTransitionもwindow.matchMediaも実装がないため、
// テスト用スタブを自作してglobalへ差し込み、フックの分岐を検証する
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useViewTransition } from './use-view-transition'

// startViewTransitionは型定義上は必須プロパティだが、jsdomには実装がないため
// deleteできるようこの箇所だけ型を緩めたDocument型を用意する
type PatchableDocument = Omit<Document, 'startViewTransition'> & {
  startViewTransition?: Document['startViewTransition']
}

const clearStartViewTransition = (): void => {
  delete (document as PatchableDocument).startViewTransition
}

// フックが参照するのはmatches値だけなので、残りのメンバーは
// 呼ばれない前提の最小実装で埋める
const createFakeMediaQueryList = (matches: boolean): MediaQueryList => {
  const stub: Partial<MediaQueryList> = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }
  return stub as MediaQueryList
}

const stubMatchMedia = (matches: boolean): void => {
  window.matchMedia = vi.fn().mockReturnValue(createFakeMediaQueryList(matches))
}

// フックは戻り値のViewTransitionを一切参照しないため、Promiseを解決済みにした
// 最小実装で埋める
const createFakeViewTransition = (): ViewTransition => {
  const stub: Partial<ViewTransition> = {
    finished: Promise.resolve(),
    ready: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    skipTransition: () => {},
  }
  return stub as ViewTransition
}

describe('useViewTransition', () => {
  beforeEach(() => {
    clearStartViewTransition()
  })

  it('1: startViewTransition未対応ならcallbackが同期実行される', () => {
    const { result } = renderHook(() => useViewTransition())
    const callback = vi.fn()

    result.current(callback)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('2: 対応かつmotion許可ならAPIが呼ばれcallbackも実行される', () => {
    stubMatchMedia(false)
    const startViewTransition = vi.fn((updateCallback?: () => void) => {
      updateCallback?.()
      return createFakeViewTransition()
    })
    document.startViewTransition = startViewTransition
    const { result } = renderHook(() => useViewTransition())
    const callback = vi.fn()

    result.current(callback)

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('3: prefers-reduced-motion: reduceならAPIを呼ばずcallbackだけ実行する', () => {
    stubMatchMedia(true)
    const startViewTransition = vi.fn((updateCallback?: () => void) => {
      updateCallback?.()
      return createFakeViewTransition()
    })
    document.startViewTransition = startViewTransition
    const { result } = renderHook(() => useViewTransition())
    const callback = vi.fn()

    result.current(callback)

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('4: startViewTransitionがthrowしてもcallbackは実行される', () => {
    stubMatchMedia(false)
    document.startViewTransition = vi.fn(() => {
      throw new Error('view transition failed')
    })
    const { result } = renderHook(() => useViewTransition())
    const callback = vi.fn()

    expect(() => result.current(callback)).not.toThrow()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('5: 返り値の関数はリレンダーしても参照が安定している', () => {
    const { result, rerender } = renderHook(() => useViewTransition())
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})
