// StoryBody(場面の並び・プレビュー・CTA・場面モーダルを束ね、開いている場面を持つ状態のコンテナ)を直接描き、
// プレビュー・CTA から場面モーダルを開いて閉じると、開いたボタンへフォーカスが戻るかを見る。
// 戻り先は開いたボタンごとに StoryBody が覚える。モーダルの中の送り・閉じ方・背景の固定そのものは ../../SceneModal/__tests__/ が見る
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import StoryBody from '@/components/Story/components/StoryBody'
import {
  emulateFullMotion,
  expectStoryTriggers,
  locateStory,
  resetEmulatedMedia,
  stubSvgFetch,
} from '@/components/Story/__tests__/story.test-helper'
import '@/styles/tokens.css'

const { story, ui, locale } = inject('storyJa')
const firstScene = story.scenes[0]

const renderBody = () => render(<StoryBody scenes={story.scenes} ui={ui} locale={locale} />)

beforeEach(async () => {
  await page.viewport(1280, 900)
  stubSvgFetch()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('場面カードから開く', () => {
  it('場面カードから開き、次・前へ送り、Escで閉じると元のボタンへ戻る', async () => {
    renderBody()
    // 同じ名前の固定 CTA より先にある、導入の場面カードを押す
    const trigger = page.getByRole('button', { name: ui.workStory.viewScene, exact: true }).first()
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect.element(dialog).toHaveAccessibleName(firstScene.title)
    await expect.element(dialog.getByRole('button', { name: ui.workStory.close })).toHaveFocus()
    // ユーザーの停止操作で自動送りを止め、手動の次・前だけを確かめる
    await dialog.getByRole('button', { name: ui.workStory.pauseScene }).click()
    // 止めると画面のボタンの名前が再開へ入れ替わる。再開の文言は StoryBody が場面モーダルへ渡す
    await expect
      .element(dialog.getByRole('button', { name: ui.workStory.resumeScene, exact: true }))
      .toBeVisible()
    const prev = dialog.getByRole('button', { name: ui.workStory.prevScene })
    const next = dialog.getByRole('button', { name: ui.workStory.nextScene })
    await expect.element(prev).toBeDisabled()

    await next.click()
    await expect.element(dialog).toHaveAccessibleName(story.scenes[1].title)
    await expect
      .element(dialog.getByText(`2 / ${story.scenes.length}`, { exact: true }))
      .toBeVisible()
    await expect.element(prev).toBeEnabled()

    await prev.click()
    await expect.element(dialog).toHaveAccessibleName(firstScene.title)
    await expect
      .element(dialog.getByText(`1 / ${story.scenes.length}`, { exact: true }))
      .toBeVisible()
    await expect.element(prev).toBeDisabled()

    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(trigger).toHaveFocus()
  })
})

describe('閉じた後のフォーカスの戻り先', () => {
  beforeEach(async () => {
    // E2E(Playwright の Desktop Chrome)と同じ画面の大きさで、ページの先頭から始める
    await page.viewport(1280, 720)
    window.scrollTo(0, 0)
    // 前のテストが背景の固定を戻し損ねても持ち越さず、戻し損ねたテストで落とす
    document.body.style.removeProperty('overflow')
    await emulateFullMotion()
  })

  afterEach(async () => {
    // 先に外してから環境を戻す
    cleanup()
    await resetEmulatedMedia()
  })

  it('Esc・閉じる・余白のどれで閉じても開いたボタンへフォーカスが戻る', async () => {
    renderBody()
    await expectStoryTriggers(ui)
    const { preview, cta, dialog, close } = locateStory(ui)

    // 戻り先は開いたボタン(CTA・プレビュー)ごとに覚えるので両方から開き分ける。Esc はブラウザ自身も
    // 開く前のフォーカスへ戻しうるので、StoryBody の戻しそのものは閉じる(プレビューへ)と余白(CTA へ)で確かめる
    // Esc: CTA から開いて閉じる
    await cta.click()
    await expect.element(dialog).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cta, { message: 'Esc で閉じると CTA へ戻る' }).toHaveFocus()

    // 閉じるボタン: プレビューから開いた時はプレビューへ戻る(戻り先は開いたボタンごとに覚える)
    await preview.click()
    await expect.element(dialog).toBeVisible()
    await close.click()
    await expect.element(dialog).not.toBeInTheDocument()
    await expect
      .element(preview, { message: '閉じるで閉じると開いたプレビューへ戻る' })
      .toHaveFocus()

    // 余白: 余白(dialog 自身)を押すと閉じ、CTA へ戻る
    await cta.click()
    await expect.element(dialog).toBeVisible()
    await dialog.click({ position: { x: 4, y: 4 } })
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cta, { message: '余白で閉じると CTA へ戻る' }).toHaveFocus()
  })
})
