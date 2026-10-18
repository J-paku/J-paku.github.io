// SceneModal を直接描き、閉じ方3通り(閉じるボタン・余白・Esc)が閉じる知らせ(onClose)を呼び、中身を押しても呼ばないことと、
// 開いている間だけ背景を止めることを見る。閉じた後に開いたボタンへフォーカスを戻すのは呼び出し側(StoryBody。../../StoryBody/__tests__/ が見る)
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import SceneModal from '@/components/Story/components/SceneModal'
import {
  counterOf,
  emulateFullMotion,
  locateModal,
  resetEmulatedMedia,
  sceneModalProps,
  stubSvgFetch,
} from '@/components/Story/__tests__/story.test-helper'
import '@/styles/tokens.css'

const { story, ui } = inject('storyJa')

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
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

describe('閉じ方と背景の固定', () => {
  it('閉じる・余白・Esc のどれでも閉じる知らせを呼び、中身を押しても呼ばない', async () => {
    const onClose = vi.fn()
    render(<SceneModal {...sceneModalProps(story.scenes, ui, onClose)} />)
    const { dialog, close } = locateModal(ui)
    const closeCalls = () => onClose.mock.calls.length
    await expect.element(dialog).toBeVisible()

    // 中身: 場面の番号を押しても閉じない
    const counter = counterOf()
    if (counter === null) throw new Error('モーダルの場面の番号が無い')
    await userEvent.click(counter)
    await expect.element(dialog, { message: '中身を押しても閉じない' }).toBeVisible()
    expect(closeCalls(), '中身を押しても閉じる知らせを呼ばない').toBe(0)

    // 余白(dialog 自身)を押す
    await dialog.click({ position: { x: 4, y: 4 } })
    await expect.poll(closeCalls, { message: '余白を押すと閉じる知らせを呼ぶ' }).toBe(1)

    // 閉じるボタンを押す。知らせを受けて外すのは呼び出し側なので、モーダルは開いたまま残る
    await close.click()
    await expect.poll(closeCalls, { message: '閉じるを押すと閉じる知らせを呼ぶ' }).toBe(2)

    // Esc はブラウザが dialog そのものを閉じるので、最後に押す
    await userEvent.keyboard('{Escape}')
    await expect.poll(closeCalls, { message: 'Esc で閉じる知らせを呼ぶ' }).toBe(3)
  })

  it('開いている間だけ背景を止め、外すと固定を解く', async () => {
    const bodyOverflow = () => document.body.style.overflow
    expect(bodyOverflow()).toBe('')

    const { unmount } = render(<SceneModal {...sceneModalProps(story.scenes, ui, vi.fn())} />)
    await expect.element(locateModal(ui).dialog).toBeVisible()
    await expect.poll(bodyOverflow, { message: '開いている間は背景を止める' }).toBe('hidden')

    unmount()
    await expect.poll(bodyOverflow, { message: '閉じたら背景の固定を解く' }).toBe('')
  })
})
