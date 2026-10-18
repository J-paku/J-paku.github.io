// SceneModal を先頭の場面から直接描き、自動送りと一時停止(WCAG 2.2.2)と、自動送りで端へ着く時のフォーカスを見る
// (E2E の story から移した)。時間は偽の時計で、場面の自動送りの setTimeout だけを止めて進める
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import SceneModal from '@/components/Story/components/SceneModal/container'
import { sceneCycleMs } from '@/utils/cycle-scenes'
import {
  counterFor,
  counterText,
  emulateFullMotion,
  flushRender,
  locateModal,
  LONG_MS,
  resetEmulatedMedia,
  sceneModalProps,
  stubSvgFetch,
} from '@/components/Story/__tests__/story.test-helper'
import '@/styles/tokens.css'

const { slug, story, ui } = inject('storyJa')
const scenes = story.scenes
const sceneCount = scenes.length
// 先頭・末尾の他に、途中の場面が2つ要る(一時停止の間に手で送る先と、再開して自動で送る先を端と見分けるため)
if (sceneCount < 4) throw new Error(`${slug} の場面が4つ未満(${sceneCount}つ)`)
const { shown, expectCounter } = counterFor(sceneCount)

// 偽の時計で ms だけ進める。発火した自動送りの描き直しと、それが掛け直す次のタイマーまでを act の中で済ませる
const runFor = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

const renderModal = () => render(<SceneModal {...sceneModalProps(scenes, ui, vi.fn())} />)

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
  // 前のテストが背景の固定を戻し損ねても持ち越さず、戻し損ねたテストで落とす
  document.body.style.removeProperty('overflow')
  await emulateFullMotion()
  stubSvgFetch()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(async () => {
  // 先に外してから時計と環境を戻す(effect の後始末が差し替えた時計のまま走るように)
  cleanup()
  vi.useRealTimers()
  await resetEmulatedMedia()
  vi.unstubAllGlobals()
})

describe('自動送り', () => {
  it('自動送りは場面の周期ちょうどで次へ進み、一時停止の間はどれだけ時間が経っても送らない', async () => {
    renderModal()
    const { pause, resume, next } = locateModal(ui)

    await expectCounter(0)
    await flushRender()
    // 周期の 1ms 手前ではまだ送らず、周期ちょうどで送る
    runFor(sceneCycleMs(scenes[0].id) - 1)
    await flushRender()
    expect(counterText(), '周期の 1ms 手前ではまだ送らない').toBe(shown(0))
    runFor(1)
    await expectCounter(1, '周期ちょうどで次へ送る')
    await flushRender()

    // 画面そのものを押すと一時停止し、ボタンの名前が再開へ入れ替わる
    await pause.click()
    await expect.element(resume).toBeVisible()
    await flushRender()
    runFor(LONG_MS)
    await flushRender()
    expect(counterText(), '一時停止の間は送らない').toBe(shown(1))

    // 手で送っても一時停止は解けない
    await next.click()
    await expectCounter(2)
    await expect.element(resume).toBeVisible()
    await flushRender()
    runFor(LONG_MS)
    await flushRender()
    expect(counterText(), '手で送った後も一時停止のまま').toBe(shown(2))

    // 再開すると、今の場面の周期で次へ送る
    await resume.click()
    await expect.element(pause).toBeVisible()
    await flushRender()
    runFor(sceneCycleMs(scenes[2].id))
    await expectCounter(3, '再開すると今の場面の周期で送る')
  })

  it('自動送りで端へ着く時は、無効になるボタンに乗っていたフォーカスだけを逃がし、他のフォーカスは奪わない', async () => {
    renderModal()
    const { close, pause, prev, next } = locateModal(ui)
    // index の場面の周期だけ進め、expected の場面へ送られて次のタイマーが掛かるまで待つ
    const advance = async (index: number, expected: number) => {
      runFor(sceneCycleMs(scenes[index].id))
      await expectCounter(expected)
      await flushRender()
    }

    await expectCounter(0)
    await flushRender()

    // 1周目: 画面そのもの(一時停止のボタン)にフォーカスを置いたまま送る。末尾へ着いても先頭へ巡っても動かさない
    pause.element().focus()
    for (let index = 1; index < sceneCount; index += 1) {
      await advance(index - 1, index)
      await expect.element(pause).toHaveFocus()
    }
    await expect.element(next).toBeDisabled()
    await advance(sceneCount - 1, 0)
    await expect
      .element(pause, { message: '先頭へ巡っても、前へ以外に乗ったフォーカスは奪わない' })
      .toHaveFocus()

    // 2周目: 次へにフォーカスを置く。途中では動かさず、末尾へ着くと無効になる次へから前へ逃がす
    next.element().focus()
    for (let index = 1; index < sceneCount - 1; index += 1) {
      await advance(index - 1, index)
      await expect.element(next).toHaveFocus()
    }
    await advance(sceneCount - 2, sceneCount - 1)
    await expect.element(next).toBeDisabled()
    await expect.element(prev, { message: '末尾へ着くと次へから前へ逃がす' }).toHaveFocus()

    // 前へに乗ったまま末尾から先頭へ巡ると、無効になる前へから閉じるへ逃がす
    await advance(sceneCount - 1, 0)
    await expect.element(prev).toBeDisabled()
    await expect.element(close, { message: '先頭へ巡ると前へから閉じるへ逃がす' }).toHaveFocus()
  })
})
