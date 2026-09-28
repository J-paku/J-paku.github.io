// 場面 SVG の原文取得の覚え方を検証する。成功は URL ごとに覚えて取り直さず、取得中の重なりは
// 同じ Promise で待ち合わせ、失敗だけは覚えを捨てて次の呼び出しで取り直す。
// 覚えを捨てたあと画面が本当に取り直して絵を出すか(部品が失敗を抱え込まないか)は、
// tests/scene-refetch.spec.ts が作品ストーリーのモーダルを開き直して見る
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// テスト用の最小 Response。fetchSvgSource が読む ok / status / text() だけを持たせる
// (as unknown は使わず、Partial<Response> を経由して型付けする。weather.test.ts と同じ形)
function fakeResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as Partial<Response> as Response
}

// 決着の時点をテスト側で決められる fetch の戻り値。取得中に重ねて呼ぶ状況を作るのに使う
function deferredResponse() {
  let settle: (response: Response) => void = () => {}
  const promise = new Promise<Response>(resolve => {
    settle = resolve
  })
  return { promise, settle }
}

const SCENE_URL = '/works/test/scene1.svg'
const SVG_SOURCE = '<svg><rect/></svg>'

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>
// 覚えはモジュール変数なので、テストごとにモジュールを読み直して空の覚えから始める。
// 静的 import のままだと、前のテストが残した成功・失敗の覚えを次のテストが引き継ぐ
let fetchSvgSource: (url: string) => Promise<string>

beforeEach(async () => {
  fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  vi.resetModules()
  const fresh = await import('./fetch-svg-source')
  fetchSvgSource = fresh.fetchSvgSource
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('fetchSvgSource', () => {
  it('応答が ok でない(503)と失敗し、次の呼び出しでは取り直して原文を返す', async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(503, 'unavailable'))
      .mockResolvedValueOnce(fakeResponse(200, SVG_SOURCE))

    await expect(fetchSvgSource(SCENE_URL)).rejects.toThrow()
    // 失敗の覚えが残っていると、ここで fetch を呼ばずに同じ失敗が返る
    await expect(fetchSvgSource(SCENE_URL)).resolves.toBe(SVG_SOURCE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('通信そのものが失敗(reject)しても、次の呼び出しでは取り直して原文を返す', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(fakeResponse(200, SVG_SOURCE))

    await expect(fetchSvgSource(SCENE_URL)).rejects.toThrow('Failed to fetch')
    await expect(fetchSvgSource(SCENE_URL)).resolves.toBe(SVG_SOURCE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('成功した原文は覚え、同じ URL の2回目以降は取りに行かず同じ Promise を返す', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, SVG_SOURCE))

    const first = fetchSvgSource(SCENE_URL)
    await expect(first).resolves.toBe(SVG_SOURCE)
    const second = fetchSvgSource(SCENE_URL)

    expect(second).toBe(first)
    await expect(second).resolves.toBe(SVG_SOURCE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('取得中に同じ URL を重ねて呼ぶと、同じ Promise を待ち合わせて1回だけ取りに行く', async () => {
    const pending = deferredResponse()
    fetchMock.mockReturnValueOnce(pending.promise)

    const first = fetchSvgSource(SCENE_URL)
    const second = fetchSvgSource(SCENE_URL)
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    pending.settle(fakeResponse(200, SVG_SOURCE))
    await expect(Promise.all([first, second])).resolves.toEqual([SVG_SOURCE, SVG_SOURCE])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('取得中に重ねた呼び出しが一緒に失敗した後も、次の呼び出しでは取り直す', async () => {
    const pending = deferredResponse()
    fetchMock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(fakeResponse(200, SVG_SOURCE))

    // 同じ場面を2か所(イントロのプレビューと全画面モーダルなど)が同時に待っている状況
    const first = fetchSvgSource(SCENE_URL)
    const second = fetchSvgSource(SCENE_URL)
    pending.settle(fakeResponse(503, 'unavailable'))

    await expect(first).rejects.toThrow()
    await expect(second).rejects.toThrow()
    await expect(fetchSvgSource(SCENE_URL)).resolves.toBe(SVG_SOURCE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
