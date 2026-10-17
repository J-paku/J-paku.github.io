// 作品ストーリー画面(コンテナ)を実データで Chromium へ描き、導入・場面・まとめ・導線が並ぶことと、
// まとめの技術チップが開閉することを確かめる。チップそのものの開閉の作法は tech-chip-popover/ が見る
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import StoryContainer from '@/components/Story/container'
import { expectChip, popoverOf } from './chip-popover.test-helper'
import { stubSvgFetch } from './story.test-helper'
import '@/styles/tokens.css'

const storyJa = inject('storyJa')
const { story, ui } = storyJa

beforeEach(async () => {
  await page.viewport(1280, 900)
  stubSvgFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('作品ストーリー画面', () => {
  it('導入・場面・まとめと、一覧・村への導線を描く', async () => {
    render(<StoryContainer {...storyJa} />)

    await expect.element(page.getByRole('main')).toBeInTheDocument()
    await expect
      .element(page.getByRole('heading', { name: story.intro.title, level: 1 }))
      .toBeVisible()
    await expect
      .element(page.getByRole('heading', { name: story.outro.title, level: 2 }))
      .toBeInTheDocument()
    for (const scene of story.scenes) {
      await expect
        .element(page.getByRole('region', { name: scene.title, exact: true }))
        .toBeInTheDocument()
    }
    // 配信物と同じく末尾にスラッシュが付く(next.config の trailingSlash。vitest.integration.config.ts の define)
    await expect
      .element(page.getByRole('link', { name: ui.workStory.back }))
      .toHaveAttribute('href', '/list/')
    await expect
      .element(page.getByRole('link', { name: storyJa.switchLabel }))
      .toHaveAttribute('href', '/')
  })

  it('まとめの技術チップを開き、外側をクリックすると閉じる', async () => {
    render(<StoryContainer {...storyJa} />)
    const outroChip = story.outro.stackSummary[0]
    // 同名の場面チップより後に描く、まとめのチップを選ぶ
    const trigger = page.getByRole('button', { name: outroChip.name, exact: true }).last()
    await expectChip(trigger, false)

    await trigger.click()
    await expectChip(trigger, true)
    expect(popoverOf(trigger).textContent).toBe(outroChip.note)

    await page.getByRole('heading', { name: story.outro.title, level: 2 }).click()
    await expectChip(trigger, false)
  })
})
