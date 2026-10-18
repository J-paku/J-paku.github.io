// IntroPreview を直接描き、場面の並びのうち先頭の場面の絵だけを見せることと、取れなかった場面を渡したプレースホルダの文字で描くことを見る。
// 場面ごとの枠を重ねて今の1枚の枠だけを不透明にするのは場面の再生(ScenePlayer。src/components/ui/ScenePlayer/__tests__/ が見る)で、
// ここで見るのはプレビューがいつも先頭の場面を今の1枚として渡すこと。どの場面の絵かは、取得の応答に絵のパスを印として持たせて見分ける
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import type { WorkStoryScene } from '@content/types/content'
import IntroPreview from '@/components/Story/components/IntroPreview'
import { scenesWithSvg } from '@/components/Story/__tests__/story.test-helper'
import '@/styles/tokens.css'

const { slug, story, ui } = inject('storyJa')
const sceneCount = story.scenes.length
// 先頭と見分ける2つめ以降の場面が要る
if (sceneCount < 2) throw new Error(`${slug} の場面が2つ未満(${sceneCount}つ)`)
const firstImage = story.scenes[0].image

// 取得の覚え(src/lib/fetch-svg-source.ts)は URL ごとにモジュールの中へ残る。前に同じ場面の絵を取ったテストの応答を
// 引き継がないよう、場面の URL に問い合わせの文字列を足して、まだ誰も取っていない URL にする(パスは実物のまま)
const freshScenes = (query: string): WorkStoryScene[] =>
  story.scenes.map(scene => ({ ...scene, image: `${scene.image}?${query}` }))

// 場面の絵の取得だけを差し替える。応答の <svg> に、取りに来た絵のパスを印として持たせる。failedPath の絵だけは 503 で落とす
const stubMarkedSvgFetch = (failedPath: string | null) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const { pathname } = new URL(new Request(input).url)
      if (pathname === failedPath) {
        return new Response('unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
      return new Response(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' data-image='${pathname}'></svg>`,
        { headers: { 'Content-Type': 'image/svg+xml' } }
      )
    })
  )
}

const renderPreview = (scenes: WorkStoryScene[]) => {
  render(
    <IntroPreview
      scenes={scenes}
      placeholder={ui.work.shotPlaceholder}
      viewSceneLabel={ui.workStory.viewScene}
      onOpenScene={vi.fn()}
    />
  )
  return page.getByRole('button', { name: ui.workStory.viewScene, exact: true })
}

// 枠が見えている(不透明)か。ScenePlayer は場面ごとの枠を重ね、今の1枚の枠だけを不透明にする
const isShown = (frame: Element | null) => frame !== null && getComputedStyle(frame).opacity === '1'

// root の中で、見えている枠に展開された絵の印(取りに来た絵のパス)
const shownImages = (root: Element) =>
  Array.from(root.querySelectorAll('*')).flatMap(host => {
    const svg = host.shadowRoot?.querySelector('svg') ?? null
    return svg !== null && isShown(host.parentElement) ? [svg.getAttribute('data-image')] : []
  })

beforeEach(async () => {
  await page.viewport(1280, 900)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('先頭の場面の絵', () => {
  it('場面の並びのうち、先頭の場面の絵だけを見せる', async () => {
    stubMarkedSvgFetch(null)
    const trigger = renderPreview(freshScenes('intro-preview-first'))

    // 全場面の絵が届いてから見る。届く前の枠には絵が無く、見えている絵が0枚でも通ってしまう
    await expect
      .poll(() => scenesWithSvg(trigger.element()), { message: '全場面の絵が届く' })
      .toBe(sceneCount)
    expect(shownImages(trigger.element()), '見えている絵は先頭の場面の1枚だけ').toEqual([
      firstImage,
    ])
  })

  it('取れなかった先頭の場面は、渡したプレースホルダの文字で見せる', async () => {
    stubMarkedSvgFetch(firstImage)
    const trigger = renderPreview(freshScenes('intro-preview-placeholder'))

    const placeholder = trigger.getByText(ui.work.shotPlaceholder, { exact: true })
    await expect.element(placeholder).toBeInTheDocument()
    expect(
      isShown(placeholder.element().parentElement),
      'プレースホルダの文字は見えている枠にある'
    ).toBe(true)
    // 取れた残りの場面は絵で描く(プレースホルダは取れなかった場面の分だけ)
    await expect.poll(() => scenesWithSvg(trigger.element())).toBe(sceneCount - 1)
    expect(trigger.getByText(ui.work.shotPlaceholder, { exact: true }).elements()).toHaveLength(1)
  })
})
