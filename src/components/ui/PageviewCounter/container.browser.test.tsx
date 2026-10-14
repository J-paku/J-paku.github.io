// ページ移動の計測(PageviewCounter)の統合テスト(Vitest Browser Mode)。実際の Chromium で描く。
// ルーターの外で描くので、App Router が usePathname へ経路を渡すのと同じ文脈(Next の PathnameContext)で経路を与え、
// 別の経路で描き直して移動を再現する。next/navigation は差し替えず、本物の usePathname がその文脈を読む。
// GoatCounter の送信関数(window.goatcounter.count)を偽物に替えて、何回・どのパスで数えさせるかを確かめる。
// 計測タグ(count.js)を読み込むのはこの部品ではないので描かず、偽物の送信関数の外へは何も出さない
import { cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// App Router が経路を配る文脈。usePathname(next/dist/client/components/navigation.js)はこれを useContext で読む。
// 公開の入口が無いので、Next 自身が読むのと同じモジュールを直に指す(別のモジュールなら別の文脈になり、経路が届かない)
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import PageviewCounter from './container'

// 読み込み時の経路
const INITIAL_PATHNAME = '/list/'

// 外へ通信させない。呼ばれたら「外への送信」の検査で落ちる
const rejectFetch = (): Promise<Response> => Promise.reject(new Error('テストでは通信しない'))

let count = vi.fn<(vars: { path: string }) => void>()
let fetchSpy = vi.fn(rejectFetch)

// 開発時と同じく Strict Mode で描く。エフェクトが2回走っても数え方が変わらないことも一緒に見る
const counterTree = (pathname: string) => (
  <StrictMode>
    <PathnameContext.Provider value={pathname}>
      <PageviewCounter />
    </PathnameContext.Provider>
  </StrictMode>
)

const renderCounter = () => render(counterTree(INITIAL_PATHNAME))

// next/link による移動の代わりに、文脈が配る経路を替えて描き直す
const navigate = (rerender: (ui: ReactNode) => void, pathname: string) => {
  rerender(counterTree(pathname))
}

beforeEach(() => {
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
    renderCounter()

    expect(count).not.toHaveBeenCalled()
  })

  it('経路が変わるたびに、移った先のパスを1件ずつ数え、同じ経路のままの描き直しでは数えない', () => {
    const { rerender } = renderCounter()

    navigate(rerender, '/works/sample/')
    expect(count).toHaveBeenCalledTimes(1)
    expect(count).toHaveBeenLastCalledWith({ path: '/works/sample/' })

    navigate(rerender, '/works/sample/')
    expect(count).toHaveBeenCalledTimes(1)

    // 読み込み時のパスへ戻る移動も1件として数える
    navigate(rerender, INITIAL_PATHNAME)
    expect(count).toHaveBeenCalledTimes(2)
    expect(count).toHaveBeenLastCalledWith({ path: INITIAL_PATHNAME })
  })
})

describe('外への送信', () => {
  it('計測タグを読み込まず、通信もしない(数えるのは偽物の送信関数だけ)', () => {
    // 実ブラウザの文書にはテストを動かすための script が元からある。描く前の一覧と比べ、1本も足していないことを見る
    const scriptsBefore = Array.from(document.scripts)
    const { rerender } = renderCounter()
    navigate(rerender, '/works/sample/')

    expect(count).toHaveBeenCalledTimes(1)
    expect(Array.from(document.scripts)).toEqual(scriptsBefore)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('計測タグが読み込まれていなくても、移動で例外を出さない', () => {
    delete window.goatcounter
    const { rerender } = renderCounter()

    expect(() => navigate(rerender, '/works/sample/')).not.toThrow()
    expect(count).not.toHaveBeenCalled()
  })
})
