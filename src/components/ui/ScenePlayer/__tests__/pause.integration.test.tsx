// 場面再生(ScenePlayer)の統合テスト(Vitest Browser Mode)のうち、一時停止の受け渡し。コンテナを実際の Chromium で、
// 取得のフック・表示の部品・場面SVG(SceneSvg)と一緒に描く(ADR 0016)。SVG の中の動きの停止は実ブラウザで見る。
// 差し替えるのは場面SVGの通信(fetch)だけ
import { render } from '@testing-library/react'
import ScenePlayer from '@/components/ui/ScenePlayer/container'
import {
  ART,
  PLACEHOLDER,
  artOf,
  makeScenes,
  stubSceneFetch,
  waitForArt,
} from './scene-player.test-helper'

afterEach(() => {
  vi.unstubAllGlobals()
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
