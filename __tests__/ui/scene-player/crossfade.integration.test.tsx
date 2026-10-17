// 場面再生(ScenePlayer)の統合テスト(Vitest Browser Mode)のうち、見せる場面の送り。コンテナを実際の Chromium で、
// 取得のフック・表示の部品・場面SVG(SceneSvg)と一緒に描く(ADR 0016)。opacity のクロスフェードは実ブラウザで見る。
// 差し替えるのは場面SVGの通信(fetch)だけ。場面の送りは呼び出し側(作品カードのリール・場面モーダル)が持つので、
// ここでは見せる場面の添字(activeIndex)を描き直して渡す
import { render } from '@testing-library/react'
import ScenePlayer from '@/components/ui/ScenePlayer/container'
import {
  ART,
  PLACEHOLDER,
  artOf,
  makeScenes,
  shownArt,
  stubSceneFetch,
  waitForArt,
} from './scene-player.test-helper'

afterEach(() => {
  vi.unstubAllGlobals()
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
