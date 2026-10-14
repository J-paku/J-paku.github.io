// 実データの画面を Chromium へ描き、場面の操作と技術チップの開閉をまとめて確かめる
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { page, userEvent, type Locator } from 'vitest/browser'
import StoryContainer from './container'
import '@/styles/tokens.css'

const storyJa = inject('storyJa')
const { story, ui } = storyJa
const firstScene = story.scenes[0]
const chip = firstScene.chips[0]

const renderChip = () => {
  render(<StoryContainer {...storyJa} />)
  return page
    .getByRole('region', { name: firstScene.title, exact: true })
    .getByRole('button', { name: chip.name, exact: true })
}

// 閉じている間も aria-controls が指す説明を DOM に残す契約を確認する
const popoverOf = (trigger: Locator): HTMLElement => {
  const popover = document.getElementById(trigger.element().getAttribute('aria-controls') ?? '')
  if (popover === null) throw new Error('チップのaria-controlsが指す要素が無い')
  return popover
}

const expectChip = async (trigger: Locator, open: boolean) => {
  await expect.element(trigger).toHaveAttribute('aria-expanded', String(open))
  await expect.poll(() => popoverOf(trigger).hidden).toBe(!open)
}

const renderOpenChip = async () => {
  const trigger = renderChip()
  await trigger.click()
  await expectChip(trigger, true)
  return trigger
}

beforeEach(async () => {
  await page.viewport(1280, 900)
  // SVG の通信だけを差し替える。フック・DOM API・子コンポーネントは本物を使う
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>', {
          headers: { 'Content-Type': 'image/svg+xml' },
        })
    )
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('マウス', () => {
  it('最初は閉じていて、乗せると説明が開き、離すと閉じる', async () => {
    const trigger = renderChip()
    await expectChip(trigger, false)

    await trigger.hover()
    await expectChip(trigger, true)

    await trigger.unhover()
    await expectChip(trigger, false)
  })

  it('乗せて開いた直後に押しても閉じない(押すのは開く専用)', async () => {
    const trigger = renderChip()

    await trigger.hover()
    await trigger.click()
    await expectChip(trigger, true)
  })
})

describe('タッチ', () => {
  // Browser Mode の userEvent にタッチの API が無いため、この入力種別だけ実 DOM へ送る。
  // pointerover/out から React の pointerenter/leave が発火する。マウスの移動を混ぜない。
  // 「タッチでは動かない」だけだと、pointerover が開閉の処理へ届かなくなっても通るので、
  // 同じ形のイベントを pointerType: 'mouse' で送ると開閉することも同じテストで見る
  it('指が触れただけの疑似ホバーでは開かない(マウスの同じイベントなら開く)', async () => {
    const trigger = renderChip()
    const element = trigger.element()

    fireEvent.pointerOver(element, { pointerType: 'touch' })
    await expectChip(trigger, false)

    fireEvent.pointerOver(element, { pointerType: 'mouse' })
    await expectChip(trigger, true)
  })

  it('タップすると開き、指が離れた後の疑似ホバーの抜けでは閉じない(マウスの同じイベントなら閉じる)', async () => {
    const trigger = renderChip()
    const element = trigger.element()

    fireEvent.pointerOver(element, { pointerType: 'touch' })
    fireEvent.pointerDown(element, { pointerType: 'touch' })
    fireEvent.pointerUp(element, { pointerType: 'touch' })
    fireEvent.click(element)
    await expectChip(trigger, true)

    fireEvent.pointerOut(element, { pointerType: 'touch' })
    await expectChip(trigger, true)

    fireEvent.pointerOut(element, { pointerType: 'mouse' })
    await expectChip(trigger, false)
  })
})

describe('閉じ方', () => {
  it('Escで閉じる', async () => {
    const trigger = await renderOpenChip()

    await userEvent.keyboard('{Escape}')
    await expectChip(trigger, false)
  })

  it('チップの中を押しても閉じず、外側を押すと閉じる', async () => {
    const trigger = await renderOpenChip()

    // pointerdown だけを送り、mouseleave や click の開く処理と切り離して外側判定を見る
    fireEvent.pointerDown(trigger.element())
    await expectChip(trigger, true)

    fireEvent.pointerDown(
      page.getByRole('heading', { name: story.intro.title, level: 1 }).element()
    )
    await expectChip(trigger, false)
  })
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

  it('場面カードから開き、次・前へ送り、Escで閉じると元のボタンへ戻る', async () => {
    render(<StoryContainer {...storyJa} />)
    // 同じ名前の固定 CTA より先にある、導入の場面カードを押す
    const trigger = page.getByRole('button', { name: ui.workStory.viewScene, exact: true }).first()
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect.element(dialog).toHaveAccessibleName(firstScene.title)
    await expect.element(dialog.getByRole('button', { name: ui.workStory.close })).toHaveFocus()
    // ユーザーの停止操作で自動送りを止め、手動の次・前だけを確かめる
    await dialog.getByRole('button', { name: ui.workStory.pauseScene }).click()
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
