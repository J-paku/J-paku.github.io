// 場面再生(ScenePlayer)の統合テスト(Vitest Browser Mode)のうち、場面SVGの原文の取得。コンテナを実際の Chromium で、
// 取得のフック・表示の部品・場面SVG(SceneSvg)と一緒に描く(ADR 0016)。
// 差し替えるのは場面SVGの通信(fetch)だけ。場面の送りは呼び出し側(作品カードのリール・場面モーダル)が持つので、
// ここでは見せる場面の添字(activeIndex)を描き直して渡す。
// 取れた原文をシャドウルートへ展開すること自体は場面SVGのテスト(scene-svg/)が見る
import { render } from '@testing-library/react'
import type { WorkStoryScene } from '@content/types/content'
import ScenePlayer from '@/components/ui/ScenePlayer/container'
import {
  ART,
  PLACEHOLDER,
  artOf,
  makeScenes,
  placeholders,
  shownArt,
  stubSceneFetch,
  svgOf,
  waitForArt,
} from './scene-player.test-helper'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('全場面の原文を場面の順に1回ずつ取って絵を出し、渡された添字の場面だけを見せる', async () => {
  const scenes = makeScenes()
  const requested = stubSceneFetch(scenes)

  render(<ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />)

  await waitForArt(ART)
  expect(requested, '見せる場面に限らず、描いた時点で全場面を順に取る').toEqual(
    scenes.map(scene => scene.image)
  )
  expect(placeholders().elements()).toHaveLength(0)
  await expect.poll(shownArt, { message: '添字 0 の場面だけが見える' }).toEqual([ART[0]])
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

test('渡し直す前の並びの取得が後から届いても、新しい並びの絵を前の絵や失敗で上書きしない', async () => {
  const scenes = makeScenes()
  // 最初の並びの取得は、テストが手放すまで返さずに留める(URL のパスごとに、返す口と落とす口を覚える)
  const held = new Map<
    string,
    { resolve: (response: Response) => void; reject: (reason: Error) => void }
  >()
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (input: RequestInfo | URL) =>
        new Promise<Response>((resolve, reject) => {
          held.set(new URL(new Request(input).url).pathname, { resolve, reject })
        })
    )
  )
  const { rerender } = render(
    <ScenePlayer scenes={scenes} activeIndex={0} placeholder={PLACEHOLDER} />
  )
  await expect.poll(() => held.size, { message: '最初の並びの3場面を取りに行く' }).toBe(3)
  const heldOf = (scene: WorkStoryScene) => {
    const entry = held.get(scene.image)
    if (entry === undefined) throw new Error(`${scene.image} の取得を留めていない`)
    return entry
  }

  // 2つ目・3つ目の場面だけ URL と絵を替えて渡し直す。1つ目は同じ URL なので、留めている取得を新しい並びも待ち合わせる
  const nextArts = [ART[0], `${ART[1]} v2`, `${ART[2]} v2`]
  const nextScenes = scenes.map(scene =>
    scene.id === 'scene-1'
      ? { ...scene }
      : { ...scene, image: scene.image.replace('.svg', '-v2.svg') }
  )
  const requested = stubSceneFetch(nextScenes, {}, nextArts)
  rerender(<ScenePlayer scenes={nextScenes} activeIndex={0} placeholder={PLACEHOLDER} />)
  await waitForArt([nextArts[1], nextArts[2]])

  // 前の並びの取得を遅れて返す。2つ目は通信の失敗、3つ目は前の絵。最後に返す1つ目は新しい並びも待っている取得なので、
  // その絵が出た時には、先に返した2つの結果も届き終えている(同じ形の Promise の連なりを先に返したため)
  heldOf(scenes[1]).reject(new TypeError('Failed to fetch'))
  heldOf(scenes[2]).resolve(
    new Response(svgOf(ART[2]), { headers: { 'content-type': 'image/svg+xml' } })
  )
  heldOf(scenes[0]).resolve(
    new Response(svgOf(ART[0]), { headers: { 'content-type': 'image/svg+xml' } })
  )
  await waitForArt([ART[0]])

  expect(placeholders().elements(), '前の並びの失敗で新しい絵を文言に替えない').toHaveLength(0)
  expect(artOf(ART[2]).query(), '前の並びの絵で新しい絵を上書きしない').toBeNull()
  await waitForArt([nextArts[1], nextArts[2]])
  expect(requested, '新しく取りに行くのは URL が替わった2場面だけ').toEqual([
    nextScenes[1].image,
    nextScenes[2].image,
  ])
})
