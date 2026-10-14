// 場面再生(ScenePlayer)の統合テスト(Vitest Browser Mode)。コンテナを実際の Chromium で、取得のフック・表示の部品と
// 一緒に描く(ADR 0016)。シャドウルートへの展開・opacity のクロスフェード・SVG の中の動きの停止は実ブラウザで見る。
// 差し替えるのは場面SVGの通信(fetch)だけ。場面の送りは呼び出し側(作品カードのリール・場面モーダル)が持つので、
// ここでは見せる場面の添字(activeIndex)を描き直して渡す
import { render } from '@testing-library/react'
import { page } from 'vitest/browser'
import type { WorkStoryScene } from '@content/types/content'
import ScenePlayer from './container'

// 取れなかった場面に出す文言。この部品は渡された文字列をそのまま出すだけなので、テストの値を渡す
const PLACEHOLDER = 'scene unavailable'

// 場面ごとの絵の中の文字。シャドウルートの中に絵が出たかを、この文字で見る
const ART = ['first scene art', 'second scene art', 'third scene art']

// 場面SVGの原文。中の文字に動きを付け、一時停止で止まるかを見られるようにする
const svgOf = (art: string) =>
  `<svg viewBox='0 0 402 874'><style>@keyframes drift { to { transform: translateX(8px) } } .anim { animation: drift 2s linear infinite }</style><text class='anim' x='16' y='40'>${art}</text></svg>`

// 取得の覚え(src/lib/fetch-svg-source.ts)は URL ごとにモジュールの中へ残り、テストをまたいで効く。
// テストごとに別の URL を振り、前のテストが取った原文を引き継がないようにする
let round = 0
const makeScenes = (): WorkStoryScene[] => {
  round += 1
  return ART.map((art, index) => ({
    id: `scene-${index + 1}`,
    title: art,
    body: art,
    chips: [],
    image: `/scene-player-test/${round}/scene-${index + 1}.svg`,
  }))
}

// 場面ごとの応答。ok は原文、unavailable は 503、offline は通信そのものの失敗
type Reply = 'ok' | 'unavailable' | 'offline'

// 場面SVGの取得を差し替え、問い合わせた URL を順に記録して返す。場面の外への問い合わせは断る。
// arts は場面の順に返す絵の文字(既定は ART)
const stubSceneFetch = (
  scenes: WorkStoryScene[],
  replies: Record<string, Reply> = {},
  arts: string[] = ART
) => {
  const requested: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const { pathname } = new URL(new Request(input).url)
      requested.push(pathname)
      const index = scenes.findIndex(scene => scene.image === pathname)
      if (index === -1) throw new TypeError(`外への問い合わせは断る: ${pathname}`)
      const reply = replies[scenes[index].id] ?? 'ok'
      if (reply === 'offline') throw new TypeError('Failed to fetch')
      if (reply === 'unavailable') return new Response('unavailable', { status: 503 })
      return new Response(svgOf(arts[index]), { headers: { 'content-type': 'image/svg+xml' } })
    })
  )
  return requested
}

const artOf = (art: string) => page.getByText(art, { exact: true })
const placeholders = () => page.getByText(PLACEHOLDER, { exact: true })

// 利用者に見えているか。クロスフェードは opacity だけで切り替える(見せない場面も DOM に残す)ので、
// opacity 0 の場面も見えないものとして数える
const isShown = (element: Element) => element.checkVisibility({ opacityProperty: true })

// 今見えている場面の絵(取れていない場面は絵が無いので数えない)
const shownArt = () =>
  ART.filter(art => {
    const element = artOf(art).query()
    return element !== null && isShown(element)
  })

const waitForArt = async (arts: string[]) => {
  for (const art of arts) await expect.element(artOf(art)).toBeInTheDocument()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('全場面の原文を場面の順に1回ずつ取ってシャドウルートへ展開し、渡された添字の場面だけを見せる', async () => {
  const scenes = makeScenes()
  const requested = stubSceneFetch(scenes)

  render(<ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />)

  await waitForArt(ART)
  for (const art of ART) {
    // 場面同士の class・id を奪い合わないよう、絵は場面ごとのシャドウルートの中に置く
    const root = artOf(art).element().getRootNode()
    if (!(root instanceof ShadowRoot)) throw new Error(`${art} がシャドウルートの外に描かれた`)
    expect(root.host.getAttribute('aria-hidden'), '場面の絵は装飾なので読み上げから外す').toBe(
      'true'
    )
  }
  expect(requested, '見せる場面に限らず、描いた時点で全場面を順に取る').toEqual(
    scenes.map(scene => scene.image)
  )
  expect(placeholders().elements()).toHaveLength(0)
  await expect.poll(shownArt, { message: '添字 0 の場面だけが見える' }).toEqual([ART[0]])
})

test('取れなかった場面(503・通信の失敗)は準備中の文言に替わり、見せる場面を送っても取り直さない', async () => {
  const scenes = makeScenes()
  const requested = stubSceneFetch(scenes, { 'scene-2': 'unavailable', 'scene-3': 'offline' })

  const { rerender } = render(
    <ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />
  )

  await expect
    .poll(() => placeholders().elements().length, { message: '取れなかった2場面が文言に替わる' })
    .toBe(2)
  await waitForArt([ART[0]])
  expect(artOf(ART[1]).query()).toBeNull()
  expect(artOf(ART[2]).query()).toBeNull()

  // 文言の場面も、送られてくれば見せる場面になる(添字 1・2 は文言の場面、0 は絵の場面)
  const steps = [
    { activeIndex: 1, shownPlaceholders: 1 },
    { activeIndex: 2, shownPlaceholders: 1 },
    { activeIndex: 0, shownPlaceholders: 0 },
  ]
  for (const { activeIndex, shownPlaceholders } of steps) {
    rerender(<ScenePlayer scenes={scenes} activeIndex={activeIndex} placeholder={PLACEHOLDER} />)
    await expect
      .poll(() => placeholders().elements().filter(isShown).length, {
        message: `添字 ${activeIndex} では見える文言が ${shownPlaceholders} 個`,
      })
      .toBe(shownPlaceholders)
  }
  await expect
    .poll(shownArt, { message: '添字 0 に戻ると取れた場面の絵が見える' })
    .toEqual([ART[0]])
  expect(requested, '一度失敗した場面は、この部品が消えるまで取り直さない').toEqual(
    scenes.map(scene => scene.image)
  )
})

test('取れなかった場面は、部品を作り直すと取り直して絵が出る。取れた場面は取り直さない', async () => {
  const scenes = makeScenes()
  stubSceneFetch(scenes, { 'scene-2': 'unavailable' })
  const first = render(<ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />)
  await expect.element(placeholders()).toBeInTheDocument()
  await waitForArt([ART[0], ART[2]])
  first.unmount()

  // 作り直した部品は前の失敗を引き継がない(場面モーダルは閉じると消え、開くたびに作られる)
  const requested = stubSceneFetch(scenes)
  render(<ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />)

  await waitForArt(ART)
  expect(placeholders().elements()).toHaveLength(0)
  expect(requested, '取り直すのは失敗した場面だけ').toEqual([scenes[1].image])
})

test('場面の並びを渡し直すと、URL が替わった場面だけを取り直して絵を差し替え、失敗した場面は取り直さない', async () => {
  const scenes = makeScenes()
  stubSceneFetch(scenes, { 'scene-2': 'unavailable' })
  const { rerender } = render(
    <ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />
  )
  await expect.element(placeholders()).toBeInTheDocument()
  await waitForArt([ART[0], ART[2]])

  // 中身の同じ場面も含めて、新しい配列・新しい要素で渡し直す。3つ目の場面だけ URL と絵を替える
  const nextArt = `${ART[2]} v2`
  const nextScenes = scenes.map(scene =>
    scene.id === 'scene-3'
      ? { ...scene, image: scene.image.replace('.svg', '-v2.svg') }
      : { ...scene }
  )
  const requested = stubSceneFetch(nextScenes, { 'scene-2': 'unavailable' }, [
    ART[0],
    ART[1],
    nextArt,
  ])
  rerender(<ScenePlayer scenes={nextScenes} activeIndex={0} placeholder={PLACEHOLDER} />)

  await expect.element(artOf(nextArt)).toBeInTheDocument()
  expect(artOf(ART[2]).query(), '前の絵は新しい絵に差し替わる').toBeNull()
  await waitForArt([ART[0]])
  expect(placeholders().elements(), '失敗した場面は文言のまま').toHaveLength(1)
  expect(requested, '取りに行くのは URL が替わった場面だけ').toEqual([nextScenes[2].image])
})

test('見せる場面を送るとその場面へクロスフェードし、入れ替わった2場面の絵だけを頭から組み直す', async () => {
  const scenes = makeScenes()
  const requested = stubSceneFetch(scenes)
  const { rerender } = render(
    <ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />
  )
  await waitForArt(ART)
  await expect.poll(shownArt).toEqual([ART[0]])

  // 呼び出し側の自動送りと同じく、末尾の次は先頭へ巡る
  let previous = 0
  for (const activeIndex of [1, 2, 0]) {
    const before = ART.map(art => artOf(art).element())
    rerender(<ScenePlayer scenes={scenes} activeIndex={activeIndex} placeholder={PLACEHOLDER} />)

    await expect
      .poll(shownArt, { message: `添字 ${activeIndex} の場面だけが見える` })
      .toEqual([ART[activeIndex]])
    // SVG の中の CSS アニメーションは組み直しでしか頭から始まらない。組み直した場面は絵の要素が新しく作られる
    const rebuilt = ART.map((art, index) => artOf(art).element() !== before[index])
    expect(rebuilt, '見せ始めた場面と見せ終えた場面だけを組み直す').toEqual(
      ART.map((_, index) => index === activeIndex || index === previous)
    )
    previous = activeIndex
  }
  expect(requested, '場面を送っても取り直さない').toEqual(scenes.map(scene => scene.image))
})

test('一時停止を渡すと場面SVGの中の動きを今の絵のまま止め、外すと動かす', async () => {
  const scenes = makeScenes()
  const requested = stubSceneFetch(scenes)
  const playStates = () => ART.map(art => getComputedStyle(artOf(art).element()).animationPlayState)

  const { rerender } = render(
    <ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />
  )
  await waitForArt(ART)
  expect(playStates(), '一時停止を渡さなければ動かす').toEqual(ART.map(() => 'running'))

  rerender(<ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} paused />)
  expect(playStates(), '一時停止中はすべての場面の動きを止める').toEqual(ART.map(() => 'paused'))

  rerender(<ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} paused={false} />)
  expect(playStates(), '再開するとまた動かす').toEqual(ART.map(() => 'running'))
  expect(requested, '一時停止の切り替えでは取り直さない').toEqual(scenes.map(scene => scene.image))
})
