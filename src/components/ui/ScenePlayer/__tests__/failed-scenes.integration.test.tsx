// 場面再生(ScenePlayer)の統合テスト(Vitest Browser Mode)のうち、取れなかった場面の扱い。コンテナを実際の Chromium で、
// 取得のフック・表示の部品・場面SVG(SceneSvg)と一緒に描く(ADR 0016)。
// 差し替えるのは場面SVGの通信(fetch)だけ。見せる場面の添字(activeIndex)は描き直して渡す
import { render } from '@testing-library/react'
import ScenePlayer from '@/components/ui/ScenePlayer'
import {
  ART,
  PLACEHOLDER,
  artOf,
  isShown,
  makeScenes,
  placeholders,
  shownArt,
  stubSceneFetch,
  waitForArt,
} from './scene-player.test-helper'

afterEach(() => {
  vi.unstubAllGlobals()
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
