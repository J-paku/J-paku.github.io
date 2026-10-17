// 作品ストーリー画面で、取得に失敗した場面の絵をモーダルを開き直すと取り直すかを見る(E2E の scene-refetch から移した)。
// イントロのプレビューと開くたびに作られる場面モーダル(StoryBody が開閉する)の両方が場面の絵を取りに行き、
// 取り直すかは場面再生(ScenePlayer)の use-scene-sources と取得の覚え(src/lib/fetch-svg-source.ts)が決める
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import StoryContainer from '@/components/Story/container'
import { locateStory, scenesWithSvg } from './story.test-helper'
import '@/styles/tokens.css'

const storyJa = inject('storyJa')
const { story, ui } = storyJa
const scenes = story.scenes
const sceneCount = scenes.length

beforeEach(async () => {
  await page.viewport(1280, 900)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('場面の絵の取り直し', () => {
  // 場面 1 の絵は、最初のこの回数だけ 503 で落とす。それより後は絵を返す。
  // 1 回目はページを開いた時のイントロのプレビュー、2 回目は最初に開いたモーダルが取りに行く分
  const FAILED_REQUESTS = 2
  const SCENE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'></svg>`

  it('場面の絵の取得に失敗しても、モーダルを開き直すと取り直して絵が出る', async () => {
    // 取得の覚え(src/lib/fetch-svg-source.ts)は URL ごとにモジュールの中へ残り、前に同じ場面の絵を取ったテストがあれば覚えている。
    // E2E はページを読み込むたびに空の覚えから始まるので、ここでは場面の URL に問い合わせの文字列を足して、
    // まだ誰も取っていない URL にする(パスは実物のまま)
    const freshStory = {
      ...storyJa,
      story: {
        ...story,
        scenes: scenes.map(scene => ({ ...scene, image: `${scene.image}?scene-refetch` })),
      },
    }
    const firstImage = scenes[0].image
    let requests = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const { pathname } = new URL(new Request(input).url)
        if (pathname === firstImage) {
          requests += 1
          if (requests <= FAILED_REQUESTS) {
            return new Response('unavailable', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          }
        }
        return new Response(SCENE_SVG, { headers: { 'Content-Type': 'image/svg+xml' } })
      })
    )
    render(<StoryContainer {...freshStory} />)
    // イントロの小さなプレビュー。開いた時点で全場面を取りに行き、場面 1 は 1 回目の失敗でプレースホルダになる
    const { preview, dialog, close } = locateStory(ui)
    const shownInDialog = () => scenesWithSvg(document.querySelector('dialog'))
    await expect.element(preview).toHaveTextContent(ui.work.shotPlaceholder)
    expect(requests).toBe(1)

    // 最初に開いたモーダルは場面 1 を取り直す。2 回目も失敗させるので、ここもプレースホルダになる
    await preview.click()
    await expect.element(dialog).toHaveTextContent(ui.work.shotPlaceholder)
    expect(requests, 'モーダルは前の失敗を引き継がず取り直す').toBe(2)
    await close.click()
    await expect.element(dialog).not.toBeInTheDocument()

    // 開き直すと取り直しが通り、全場面の絵がシャドウルートに出る
    await preview.click()
    await expect.element(dialog).toBeVisible()
    await expect
      .poll(shownInDialog, { message: '全場面の絵がシャドウルートに出る' })
      .toBe(sceneCount)
    await expect.element(dialog).not.toHaveTextContent(ui.work.shotPlaceholder)
    expect(requests, '失敗した後の取り直しは 1 回だけ').toBe(3)
    await close.click()
    await expect.element(dialog).not.toBeInTheDocument()

    // 成功した絵は覚えているので、もう一度開いても取りに行かずに出る
    await preview.click()
    await expect.element(dialog).toBeVisible()
    await expect.poll(shownInDialog).toBe(sceneCount)
    expect(requests, '成功した絵は取り直さない').toBe(3)
  })
})
