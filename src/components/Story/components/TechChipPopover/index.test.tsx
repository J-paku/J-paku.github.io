// @vitest-environment happy-dom
// 作品ストーリーの技術チップ(TechChipPopover)の統合テスト。実データのチップをhappy-domへ描き、
// マウスとタッチの違い・Esc・外側の押下で分かれる開閉を、利用者に見える形
// (aria-expanded・aria-controlsが指す説明のhidden)で確かめる
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TechChipPopover from './index'

// server-onlyはvitestでは無条件に例外を投げるため、中身を持たないmockに差し替える
vi.mock('server-only', () => ({}))

import { readContent } from '@/lib/content/read'

const { works } = readContent('ja')

// ストーリーの場面に載っている最初のチップ
const scenes = works.flatMap(work => work.story?.scenes ?? [])
const chip = scenes.flatMap(scene => scene.chips).at(0)

const renderChip = () => {
  if (chip === undefined) throw new Error('ストーリーの場面にチップがcontentに無い')
  render(
    <>
      <button type='button'>外側</button>
      <TechChipPopover chip={chip} locale='ja' />
    </>
  )
  return screen.getByRole('button', { name: chip.name })
}

const isOpen = (trigger: HTMLElement) => trigger.getAttribute('aria-expanded') === 'true'

// aria-controlsが指す説明。閉じている間も要素は残し、hiddenで畳む
const popoverOf = (trigger: HTMLElement): HTMLElement => {
  const popover = document.getElementById(trigger.getAttribute('aria-controls') ?? '')
  if (popover === null) throw new Error('チップのaria-controlsが指す要素が無い')
  return popover
}

// 開いた状態から始める。マウスで押す(乗せてから押す)と開く
const renderOpenChip = async () => {
  const user = userEvent.setup()
  const trigger = renderChip()
  await user.click(trigger)
  expect(isOpen(trigger)).toBe(true)
  return { user, trigger }
}

afterEach(() => {
  cleanup()
})

describe('マウス', () => {
  it('最初は閉じていて、乗せると説明が開き、離すと閉じる', async () => {
    const user = userEvent.setup()
    const trigger = renderChip()
    expect(isOpen(trigger)).toBe(false)
    expect(popoverOf(trigger).hidden).toBe(true)

    await user.hover(trigger)
    expect(isOpen(trigger)).toBe(true)
    expect(popoverOf(trigger).hidden).toBe(false)

    await user.unhover(trigger)
    expect(isOpen(trigger)).toBe(false)
    expect(popoverOf(trigger).hidden).toBe(true)
  })

  it('乗せて開いた直後に押しても閉じない(押すのは開く専用)', async () => {
    const user = userEvent.setup()
    const trigger = renderChip()

    await user.hover(trigger)
    await user.click(trigger)
    expect(isOpen(trigger)).toBe(true)
    expect(popoverOf(trigger).hidden).toBe(false)
  })
})

describe('タッチ', () => {
  it('指が触れただけの疑似ホバーでは開かない', () => {
    const trigger = renderChip()

    fireEvent.pointerEnter(trigger, { pointerType: 'touch' })
    expect(isOpen(trigger)).toBe(false)
  })

  it('タップすると開き、指が離れた後の疑似ホバーの抜けでは閉じない', async () => {
    const user = userEvent.setup()
    const trigger = renderChip()

    await user.pointer({ keys: '[TouchA]', target: trigger })
    expect(isOpen(trigger)).toBe(true)

    fireEvent.pointerLeave(trigger, { pointerType: 'touch' })
    expect(isOpen(trigger)).toBe(true)
    expect(popoverOf(trigger).hidden).toBe(false)
  })
})

describe('閉じ方', () => {
  it('Escで閉じる', async () => {
    const { user, trigger } = await renderOpenChip()

    await user.keyboard('{Escape}')
    expect(isOpen(trigger)).toBe(false)
    expect(popoverOf(trigger).hidden).toBe(true)
  })

  it('チップの中を押しても閉じず、外側を押すと閉じる', async () => {
    const { trigger } = await renderOpenChip()

    // 押下の始まり(pointerdown)だけを送る。クリックまで送るとチップ自身の開く処理が混ざる
    fireEvent.pointerDown(trigger)
    expect(isOpen(trigger)).toBe(true)

    fireEvent.pointerDown(screen.getByRole('button', { name: '外側' }))
    expect(isOpen(trigger)).toBe(false)
    expect(popoverOf(trigger).hidden).toBe(true)
  })
})
