// StoryBody を場面のある並びと場面の無い並びで描き分け、場面を見せるプレビューと CTA を場面があるときだけ描くかを見る。
// 実際のコンテンツに場面の無い作品は無いので、場面を空にした props を直接渡す(ADR 0017 D6)
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import StoryBody from '@/components/Story/components/StoryBody/container'
import { expectStoryTriggers, locateStory, stubSvgFetch } from '../story.test-helper'
import '@/styles/tokens.css'

const { story, ui, locale } = inject('storyJa')

beforeEach(async () => {
  await page.viewport(1280, 900)
  stubSvgFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('場面の数とモーダルを開くボタン', () => {
  // 下の「描かない」が、探し方の誤りで空振りしていないことの対照
  it('場面があれば、場面を並べ、プレビューと CTA を1つずつ描く', async () => {
    render(<StoryBody scenes={story.scenes} ui={ui} locale={locale} />)

    for (const scene of story.scenes) {
      await expect
        .element(page.getByRole('region', { name: scene.title, exact: true }))
        .toBeInTheDocument()
    }
    await expectStoryTriggers(ui)
  })

  it('場面が無ければ、場面もプレビューも CTA も描かない', async () => {
    render(<StoryBody scenes={[]} ui={ui} locale={locale} />)
    const { preview, cta } = locateStory(ui)

    expect(page.getByRole('region').elements(), '場面を描かない').toHaveLength(0)
    expect(preview.elements(), 'プレビューを描かない').toHaveLength(0)
    expect(cta.elements(), 'CTA を描かない').toHaveLength(0)
    expect(page.getByRole('button').elements(), '押せるものを1つも描かない').toHaveLength(0)
  })
})
