// 場面SVG(SceneSvg)の統合テスト(Vitest Browser Mode)のうち、一時停止。部品を実際の Chromium で直接描き、
// シャドウルートの中の動きが止まるかを計算後のスタイルで見る。
// 一時停止を場面ごとに渡す流れは場面再生のテスト(../../../__tests__/pause.integration.test.tsx)が見る
import { render } from '@testing-library/react'
import SceneSvg from '@/components/ui/ScenePlayer/components/SceneSvg/container'
import { ART, artOf, svgOf } from '@/components/ui/ScenePlayer/__tests__/scene-player.test-helper'

test('一時停止を渡すとシャドウルートの中の動きを今の絵のまま止め、外すと動かす', async () => {
  const source = svgOf(ART[0])
  const playState = () => getComputedStyle(artOf(ART[0]).element()).animationPlayState

  const { rerender } = render(
    <SceneSvg source={source} className='' restartKey='off' paused={false} />
  )
  await expect.element(artOf(ART[0])).toBeInTheDocument()
  expect(playState(), '一時停止を渡さなければ動かす').toBe('running')

  rerender(<SceneSvg source={source} className='' restartKey='off' paused />)
  expect(playState(), '一時停止中は動きを止める').toBe('paused')

  rerender(<SceneSvg source={source} className='' restartKey='off' paused={false} />)
  expect(playState(), '再開するとまた動かす').toBe('running')
})
