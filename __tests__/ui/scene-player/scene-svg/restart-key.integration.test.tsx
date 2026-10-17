// 場面SVG(SceneSvg)の統合テスト(Vitest Browser Mode)のうち、組み直しの合図(restartKey)。部品を実際の Chromium で直接描く。
// SVG の中の CSS アニメーションは組み直しでしか頭から始まらないので、組み直した時は絵の要素が新しく作られる。
// どの場面の restartKey を替えるかは場面再生のテスト(../crossfade.integration.test.tsx)が見る
import { render } from '@testing-library/react'
import SceneSvg from '@/components/ui/ScenePlayer/components/SceneSvg/container'
import { ART, artOf, svgOf } from '../scene-player.test-helper'

test('restartKey が替わると同じ原文のまま絵を組み直し、ほかの props の描き直しでは組み直さない', async () => {
  const source = svgOf(ART[0])
  const { rerender } = render(
    <SceneSvg source={source} className='' restartKey='off' paused={false} />
  )
  await expect.element(artOf(ART[0])).toBeInTheDocument()
  const first = artOf(ART[0]).element()

  rerender(<SceneSvg source={source} className='' restartKey='off' paused />)
  expect(artOf(ART[0]).element(), '一時停止の切り替えでは組み直さない').toBe(first)

  rerender(<SceneSvg source={source} className='' restartKey='on' paused />)
  expect(artOf(ART[0]).element(), 'restartKey が替わると組み直す').not.toBe(first)
})
