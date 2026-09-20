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

  it('呼び出し側が中断済みなら none を返し、未処理の reject を出さない', async () => {
    const unhandledRejection = vi.fn()
    process.on('unhandledRejection', unhandledRejection)

    fetchMock.mockImplementation((_input, init) => {
      if (init?.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
      return Promise.resolve(fakeResponse(200, { current: { precipitation: 0, snowfall: 0 } }))
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
