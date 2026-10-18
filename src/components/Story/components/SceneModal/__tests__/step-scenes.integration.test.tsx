// SceneModal(場面送り・自動送り・一時停止を持つ状態のコンテナ)を先頭の場面から直接描き、前へ・次へで1つずつ送ることと、
// 端でボタンが無効になる直前にフォーカスを隣のボタンへ逃がすことを見る(E2E の story から移した)
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import SceneModal from '@/components/Story/components/SceneModal/container'
import {
  counterFor,
  emulateFullMotion,
  locateModal,
  press,
  resetEmulatedMedia,
  sceneModalProps,
  stubSvgFetch,
} from '@/components/Story/__tests__/story.test-helper'
import '@/styles/tokens.css'

const { slug, story, ui } = inject('storyJa')
const scenes = story.scenes
const sceneCount = scenes.length
// 先頭・末尾の他に、途中の場面が2つ要る(途中から途中へ送るのを端と見分けるため)
if (sceneCount < 4) throw new Error(`${slug} の場面が4つ未満(${sceneCount}つ)`)
const { expectCounter } = counterFor(sceneCount)

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
  // 前のテストが背景の固定を戻し損ねても持ち越さず、戻し損ねたテストで落とす
  document.body.style.removeProperty('overflow')
  await emulateFullMotion()
  stubSvgFetch()
})

afterEach(async () => {
  // 先に外してから時計と環境を戻す(effect の後始末が差し替えた時計のまま走るように)
  cleanup()
  vi.useRealTimers()
  await resetEmulatedMedia()
  vi.unstubAllGlobals()
})

describe('前へ・次へ', () => {
  it('前へ・次へで1つずつ送り、端ではそのボタンが無効になってフォーカスが隣のボタンへ移る', async () => {
    // 自動送りが割り込まないよう、時計を止めてから開く(進めない限りタイマーは発火しない)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<SceneModal {...sceneModalProps(scenes, ui, vi.fn())} />)
    const { dialog, close, prev, next } = locateModal(ui)

    await expect.element(dialog).toHaveAccessibleName(scenes[0].title)
    await expectCounter(0)
    await expect.element(close, { message: '開いたら閉じるへフォーカスが乗る' }).toHaveFocus()
    await expect.element(prev).toBeDisabled()
    await expect.element(next).toBeEnabled()

    // 末尾の1つ手前までは、押した次へにフォーカスが残る
    for (let index = 1; index < sceneCount - 1; index += 1) {
      await press(next, '{Enter}')
      await expectCounter(index)
      await expect.element(dialog).toHaveAccessibleName(scenes[index].title)
      await expect.element(next).toHaveFocus()
      await expect.element(prev).toBeEnabled()
    }
    // 末尾へ着くと次へが無効になり、フォーカスは body へ落ちずに前へへ移る
    await press(next, '{Enter}')
    await expectCounter(sceneCount - 1)
    await expect.element(dialog).toHaveAccessibleName(scenes[sceneCount - 1].title)
    await expect.element(next).toBeDisabled()
    await expect.element(prev, { message: '末尾へ着くと次へから前へ移る' }).toHaveFocus()

    // 戻りも同じ。先頭の1つ手前までは、押した前へにフォーカスが残る
    for (let index = sceneCount - 2; index > 0; index -= 1) {
      await press(prev, '{Enter}')
      await expectCounter(index)
      await expect.element(dialog).toHaveAccessibleName(scenes[index].title)
      await expect.element(prev).toHaveFocus()
      await expect.element(next).toBeEnabled()
    }
    // 先頭へ着くと前へが無効になり、フォーカスは次へへ移る
    await press(prev, '{Enter}')
    await expectCounter(0)
    await expect.element(dialog).toHaveAccessibleName(scenes[0].title)
    await expect.element(prev).toBeDisabled()
    await expect.element(next, { message: '先頭へ着くと前へから次へ移る' }).toHaveFocus()
  })
})
