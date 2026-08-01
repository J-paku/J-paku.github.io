// jsdomにはIntersectionObserverの実装がないため、テスト用スタブを自作して
// globalThisへ差し込み、コールバックを手動発火して動作を検証する
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useScrollSpy } from './use-scroll-spy'

// isIntersecting/target以外のフィールドはhook側が参照しないため最小のダミー値で埋める
const emptyRect: DOMRectReadOnly = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({}),
}

const createEntry = (target: Element, isIntersecting: boolean): IntersectionObserverEntry => ({
  boundingClientRect: emptyRect,
  intersectionRatio: isIntersecting ? 1 : 0,
  intersectionRect: emptyRect,
  isIntersecting,
  rootBounds: null,
  target,
  time: 0,
})

class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = []

  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly scrollMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []

  disconnected = false
  observedTargets: Element[] = []

  private readonly callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }

  observe(target: Element): void {
    this.observedTargets.push(target)
  }

  unobserve(target: Element): void {
    this.observedTargets = this.observedTargets.filter((el) => el !== target)
  }

  disconnect(): void {
    this.disconnected = true
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  // テスト側から交差状態を手動発火するためのヘルパー
  trigger(states: Array<{ target: Element; isIntersecting: boolean }>): void {
    const entries = states.map(({ target, isIntersecting }) => createEntry(target, isIntersecting))
    this.callback(entries, this)
  }
}

// DOM追加順=文書順になる。呼び出し順どおりにbody末尾へ積む
const appendSection = (id: string): HTMLElement => {
  const el = document.createElement('section')
  el.id = id
  document.body.appendChild(el)
  return el
}

describe('useScrollSpy', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = []
    globalThis.IntersectionObserver = FakeIntersectionObserver
    document.body.innerHTML = ''
  })

  it('1: 初期状態はnull', () => {
    appendSection('hero')
    const { result } = renderHook(() => useScrollSpy(['hero']))
    expect(result.current).toBeNull()
  })

  it('2: 一つのセクションが交差するとそのidになる', () => {
    appendSection('hero')
    appendSection('works')
    const { result } = renderHook(() => useScrollSpy(['hero', 'works']))
    const observer = FakeIntersectionObserver.instances[0]
    const hero = document.getElementById('hero') as HTMLElement

    act(() => {
      observer.trigger([{ target: hero, isIntersecting: true }])
    })

    expect(result.current).toBe('hero')
  })

  it('3: 二つのセクションが同時に交差すると実際のDOM順で先の方のidになる', () => {
    // DOM上はworksが先・heroが後。フックへ渡す配列順はその逆(hero, works)にして、
    // 配列の並びではなく実文書順(compareDocumentPosition)で判定することを確認する
    const works = appendSection('works')
    const hero = appendSection('hero')
    const { result } = renderHook(() => useScrollSpy(['hero', 'works']))
    const observer = FakeIntersectionObserver.instances[0]

    act(() => {
      observer.trigger([
        { target: works, isIntersecting: true },
        { target: hero, isIntersecting: true },
      ])
    })

    expect(result.current).toBe('works')
  })

  it('4: 交差が全て解除されると直前の値を維持する', () => {
    // 決定事項: 全解除時はnullに戻さず直前のidを保持する(ナビゲーション表示のちらつき防止)
    const hero = appendSection('hero')
    const { result } = renderHook(() => useScrollSpy(['hero']))
    const observer = FakeIntersectionObserver.instances[0]

    act(() => {
      observer.trigger([{ target: hero, isIntersecting: true }])
    })
    expect(result.current).toBe('hero')

    act(() => {
      observer.trigger([{ target: hero, isIntersecting: false }])
    })
    expect(result.current).toBe('hero')
  })

  it('5: アンマウント時にdisconnectが呼ばれる', () => {
    appendSection('hero')
    const { unmount } = renderHook(() => useScrollSpy(['hero']))
    const observer = FakeIntersectionObserver.instances[0]

    unmount()

    expect(observer.disconnected).toBe(true)
  })

  it('6: 存在しないidを含んでも例外を投げず残りだけ観測する', () => {
    appendSection('hero')

    expect(() => renderHook(() => useScrollSpy(['missing', 'hero']))).not.toThrow()

    const observer = FakeIntersectionObserver.instances[0]
    expect(observer.observedTargets).toHaveLength(1)
    expect(observer.observedTargets[0].id).toBe('hero')
  })
})
