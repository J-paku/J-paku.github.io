// GoatCounter への送信を検証する。タグが読み込まれていればパスを1件数えさせ、
// 未ロード(広告ブロックで弾かれた・async 読み込みが終わっていない)なら例外を出さずに黙って返す
import { afterEach, describe, expect, it, vi } from 'vitest'
import { countPageview } from './analytics'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('countPageview', () => {
  it('タグが読み込まれていれば、渡したパスを1件数えさせる', () => {
    const count = vi.fn()
    vi.stubGlobal('window', { goatcounter: { count } })

    countPageview('/list/')

    expect(count).toHaveBeenCalledTimes(1)
    expect(count).toHaveBeenCalledWith({ path: '/list/' })
  })

  it('タグが未ロードなら何もせず、例外を出さずに返す', () => {
    vi.stubGlobal('window', {})

    expect(() => countPageview('/list/')).not.toThrow()
  })

  it('タグはあっても count がまだ無ければ何もせず、例外を出さずに返す', () => {
    vi.stubGlobal('window', { goatcounter: {} })

    expect(() => countPageview('/list/')).not.toThrow()
  })
})
