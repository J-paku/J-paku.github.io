// 開発時の二重実行(StrictMode)で作品ストーリー画面を描き、場面モーダルの開閉が崩れないかを見る。
// E2E から移したものではない。フックの分岐(dialog が既に開いている時に showModal を呼び直さない・effect の二重実行)を、
// 利用者に見える形で確かめる。画面の全部のフックを二重実行の下で通すため、作品ストーリー画面のコンテナごと描く
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import StoryContainer from '@/components/Story'
import {
  emulateFullMotion,
  locateStory,
  resetEmulatedMedia,
  stubSvgFetch,
} from './story.test-helper'
import '@/styles/tokens.css'

const storyJa = inject('storyJa')
const { ui } = storyJa

beforeEach(async () => {
  await page.viewport(1280, 720)
  window.scrollTo(0, 0)
  // 前のテストが背景の固定を戻し損ねても持ち越さず、戻し損ねたテストで落とす
  document.body.style.removeProperty('overflow')
  await emulateFullMotion()
  stubSvgFetch()
})

afterEach(async () => {
  // 先に外してから環境を戻す
  cleanup()
  await resetEmulatedMedia()
  vi.unstubAllGlobals()
})

describe('開発時の二重実行', () => {
  it('開発時の二重実行(StrictMode)でも、モーダルは開いたまま閉じるへフォーカスが乗り、閉じると背景の固定を解く', async () => {
    render(<StoryContainer {...storyJa} />, { reactStrictMode: true })
    const { cta, dialog, close } = locateStory(ui)

    await cta.click()
    await expect.element(dialog).toBeVisible()
    await expect.element(close).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await close.click()
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cta).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })
})
