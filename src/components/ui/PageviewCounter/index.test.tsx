// @vitest-environment happy-dom
// ページ移動の計測(PageviewCounter)の統合テスト。next/navigation の usePathname を差し替えて経路を動かし、
// GoatCounter の送信関数(window.goatcounter.count)を偽物に替えて、何回・どのパスで数えさせるかを確かめる。
// 計測タグ(count.js)を読み込むのはこの部品ではないので描かず、偽物の送信関数の外へは何も出さない
import { cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PageviewCounter from './index'

// 今の経路。usePathname はこの値を返す
const navigation = vi.hoisted(() => ({ pathname: '/list/' }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))

// 外へ通信させない。呼ばれたら「外への送信」の検査で落ちる
const rejectFetch = (): Promise<Response> => Promise.reject(new Error('テストでは通信しない'))

let count = vi.fn<(vars: { path: string }) => void>()
let fetchSpy = vi.fn(rejectFetch)

// 開発時と同じく Strict Mode で描く。エフェクトが2回走っても数え方が変わらないことも一緒に見る
const counterTree = () => (
  <StrictMode>
    <PageviewCounter />
  </StrictMode>
)

// next/link による移動の代わりに、usePathname の返す経路を替えて描き直す
const navigate = (rerender: (ui: ReactNode) => void, pathname: string) => {
  navigation.pathname = pathname
  rerender(counterTree())
}

beforeEach(() => {
  navigation.pathname = '/list/'
  count = vi.fn<(vars: { path: string }) => void>()
  window.goatcounter = { count }
  fetchSpy = vi.fn(rejectFetch)
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete window.goatcounter
})

describe('数える回数', () => {
  it('読み込み時のパスは数えない(読み込みの1件は計測タグ自身が送る)', () => {
    render(counterTree())

    expect(count).not.toHaveBeenCalled()
  })

  it('経路が変わるたびに、移った先のパスを1件ずつ数え、同じ経路のままの描き直しでは数えない', () => {
    const { rerender } = render(counterTree())

    navigate(rerender, '/works/sample/')
    expect(count).toHaveBeenCalledTimes(1)
    expect(count).toHaveBeenLastCalledWith({ path: '/works/sample/' })

    navigate(rerender, '/works/sample/')
    expect(count).toHaveBeenCalledTimes(1)

    // 読み込み時のパスへ戻る移動も1件として数える
    navigate(rerender, '/list/')
    expect(count).toHaveBeenCalledTimes(2)
    expect(count).toHaveBeenLastCalledWith({ path: '/list/' })
  })
})

describe('外への送信', () => {
  it('計測タグを読み込まず、通信もしない(数えるのは偽物の送信関数だけ)', () => {
    const { rerender } = render(counterTree())
    navigate(rerender, '/works/sample/')

    expect(count).toHaveBeenCalledTimes(1)
    expect(document.querySelector('script')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('計測タグが読み込まれていなくても、移動で例外を出さない', () => {
    delete window.goatcounter
    const { rerender } = render(counterTree())

    expect(() => navigate(rerender, '/works/sample/')).not.toThrow()
    expect(count).not.toHaveBeenCalled()
  })
})
