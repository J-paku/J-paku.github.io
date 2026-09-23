// Open-Meteo 応答のパースと、あらゆる失敗が 'none' に丸まることを検証する
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOsakaPrecipitation } from './weather'

// テスト用の最小 Response。fetch() の戻り値として使う分だけ持たせる
// (as unknown は使わず、Partial<Response> を経由して型付けする)
function fakeResponse<T>(status: number, body: T): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Partial<Response> as Response
}

// 本文が JSON として読めない Response。障害時に HTML のエラーページが返る場合や
// 途中で切れた応答のように、ok=true のまま json() が失敗する状況を模す
function fakeUnparsableResponse(status: number, error: Error): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(error),
  } as Partial<Response> as Response
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fetchOsakaPrecipitation', () => {
  it('降雪が正なら snow を返す', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { current: { precipitation: 0.4, snowfall: 0.4 } })
    )

    expect(await fetchOsakaPrecipitation()).toBe('snow')
  })

  it('降雪が0で降水が正なら rain を返す', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { current: { precipitation: 2.4, snowfall: 0 } })
    )

    expect(await fetchOsakaPrecipitation()).toBe('rain')
  })

  it('降雪が0で降水がごく弱い(0.1)ときも rain を返す', async () => {
    // 基準値0のすぐ上の値にしておくと、判定の基準値が0.1以上へずれたときに落ちる
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { current: { precipitation: 0.1, snowfall: 0 } })
    )

    expect(await fetchOsakaPrecipitation()).toBe('rain')
  })

  it('降雪も降水も0なら none を返す', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { current: { precipitation: 0, snowfall: 0 } })
    )

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('fetch が reject したら none を返す', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('応答がステータス500(ok=false)なら none を返す', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(500, { current: { precipitation: 2.4, snowfall: 0 } })
    )

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('current フィールドが無い応答は none を返す', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, {}))

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('precipitation が数値でない応答は none を返す', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { current: { precipitation: '2.4', snowfall: 0 } })
    )

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('本文が JSON として読めない(json() が失敗する)なら none を返す', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeUnparsableResponse(200, new SyntaxError('Unexpected token < in JSON at position 0'))
    )

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('snowfall が数値でない応答は none を返す', async () => {
    // 文字列 '0.4' も比較 > 0 では真になる。形の検査が無ければ snow に化けるので、
    // snowfall の型を見る検査だけがこの入力を none に留めている
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { current: { precipitation: 0, snowfall: '0.4' } })
    )

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('ok=true でも本文が空文字なら none を返す', async () => {
    // 本文が object ですらない場合。形の検査を外しても current の参照で例外になり catch が none に
    // 丸めるので、この 2 件が見ているのは「例外が呼び出し側へ漏れず none で返る」ことだけ
    // (形の検査そのものは、precipitation / snowfall が数値でない応答の 2 件が押さえる)
    fetchMock.mockResolvedValueOnce(fakeResponse(200, ''))

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('ok=true でも本文が HTML なら none を返す', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, '<!doctype html><html><body>502 Bad Gateway</body></html>')
    )

    expect(await fetchOsakaPrecipitation()).toBe('none')
  })

  it('呼び出し側が中断済みなら none を返し、未処理の reject を出さない', async () => {
    const unhandledRejection = vi.fn()
    process.on('unhandledRejection', unhandledRejection)

    // 中断が届かなかったときは雨の応答が返る。結果が none か rain かで中断の有無が分かれる
    // (本文を降水0にすると、中断が無視されても none になり何も確かめられない)
    fetchMock.mockImplementation((_input, init) => {
      if (init?.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
      return Promise.resolve(fakeResponse(200, { current: { precipitation: 2.4, snowfall: 0 } }))
    })
    const controller = new AbortController()
    controller.abort()

    const result = await fetchOsakaPrecipitation(controller.signal)
    // マイクロタスクを一巡させ、拾われない reject が出ていないか確認する
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(result).toBe('none')
    expect(unhandledRejection).not.toHaveBeenCalled()

    process.off('unhandledRejection', unhandledRejection)
  })

  it('5秒のタイムアウトで中断されたら none を返す', async () => {
    // vi.useFakeTimers() は AbortSignal.timeout の内部タイマーを動かせない(実測: 応答待ちのまま
    // テストが時間切れになる)ため、タイムアウト用の signal 自体を中断済みのものへ差し替える
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController()
      controller.abort(new DOMException('The operation timed out', 'TimeoutError'))
      return controller.signal
    })
    // 中断が fetch に届かなければ雨の応答が返る。none か rain かで届いたかどうかが分かれる
    fetchMock.mockImplementation((_input, init) => {
      if (init?.signal?.aborted) return Promise.reject(init.signal.reason)
      return Promise.resolve(fakeResponse(200, { current: { precipitation: 2.4, snowfall: 0 } }))
    })

    expect(await fetchOsakaPrecipitation()).toBe('none')
    expect(timeoutSpy).toHaveBeenCalledWith(5000)
  })

  it('リクエストURLに大阪の緯度経度と現在値パラメータが含まれる', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { current: { precipitation: 0, snowfall: 0 } })
    )

    await fetchOsakaPrecipitation()

    const [requestedUrl] = fetchMock.mock.calls[0] ?? []
    expect(String(requestedUrl)).toContain('latitude=34.69')
    expect(String(requestedUrl)).toContain('longitude=135.5')
    expect(String(requestedUrl)).toContain('current=precipitation,snowfall')
  })
})
