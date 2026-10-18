// 場面SVG(SceneSvg)の統合テスト(Vitest Browser Mode)のうち、原文の展開。部品を実際の Chromium で直接描き、
// 渡された原文がシャドウルートの中へ展開されるかを見る。原文は props で渡すので通信はしない。
// 原文を取って渡す流れは場面再生のテスト(../../../__tests__/fetch-sources.integration.test.tsx)が見る
import { render } from '@testing-library/react'
import SceneSvg from '@/components/ui/ScenePlayer/components/SceneSvg/container'
import { ART, artOf, svgOf } from '@/components/ui/ScenePlayer/__tests__/scene-player.test-helper'

// 絵の文字から、それを展開したシャドウルートを引く。シャドウルートの外に描かれていたら落とす
const shadowRootOf = (art: string) => {
  const root = artOf(art).element().getRootNode()
  if (!(root instanceof ShadowRoot)) throw new Error(`${art} がシャドウルートの外に描かれた`)
  return root
}

test('渡された原文を場面ごとのシャドウルートの中へ展開し、ホストを読み上げから外す', async () => {
  render(
    <>
      {ART.map(art => (
        <SceneSvg key={art} source={svgOf(art)} className='' restartKey='off' paused={false} />
      ))}
    </>
  )

  for (const art of ART) {
    await expect.element(artOf(art)).toBeInTheDocument()
    // 場面同士の class・id を奪い合わないよう、絵は場面ごとのシャドウルートの中に置く
    expect(
      shadowRootOf(art).host.getAttribute('aria-hidden'),
      '場面の絵は装飾なので読み上げから外す'
    ).toBe('true')
  }
})

test('原文が届くまでは何も展開せずに待ち、届くとシャドウルートの中へ展開する', async () => {
  const { rerender } = render(
    <SceneSvg source={null} className='' restartKey='off' paused={false} />
  )
  expect(artOf(ART[0]).query(), '原文が届く前は絵を出さない').toBeNull()

  rerender(<SceneSvg source={svgOf(ART[0])} className='' restartKey='off' paused={false} />)

  await expect.element(artOf(ART[0])).toBeInTheDocument()
  expect(shadowRootOf(ART[0]).host.getAttribute('aria-hidden')).toBe('true')
})

test('原文が替わると、同じシャドウルートの中身を新しい原文に差し替える', async () => {
  const { rerender } = render(
    <SceneSvg source={svgOf(ART[0])} className='' restartKey='off' paused={false} />
  )
  await expect.element(artOf(ART[0])).toBeInTheDocument()
  const root = shadowRootOf(ART[0])

  rerender(<SceneSvg source={svgOf(ART[1])} className='' restartKey='off' paused={false} />)

  await expect.element(artOf(ART[1])).toBeInTheDocument()
  expect(artOf(ART[0]).query(), '前の原文の絵は残さない').toBeNull()
  // attachShadow は1要素につき1回だけ。2回目は例外になるので、作ったシャドウルートへ流し込み直す
  expect(shadowRootOf(ART[1]), 'シャドウルートを作り直さない').toBe(root)
})
