// 技術チップを直接描き、開いた説明を Esc とチップの外側の pointerdown で閉じることを見る
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, inject, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import TechChipPopover from '@/components/Story/components/TechChipPopover/container'
import { expectChip } from '@/components/Story/__tests__/chip-popover.test-helper'
import '@/styles/tokens.css'

const { story, locale } = inject('storyJa')
const chip = story.scenes[0].chips[0]

// 外側を押す先として、チップの外に見出しを1つ並べて描き、チップを開いておく
const renderOpenChip = async () => {
  render(
    <>
      <h1>{story.intro.title}</h1>
      <TechChipPopover chip={chip} locale={locale} />
    </>
  )
  const trigger = page.getByRole('button', { name: chip.name, exact: true })
  await trigger.click()
  await expectChip(trigger, true)
  return trigger
}

beforeEach(async () => {
  await page.viewport(1280, 900)
})

afterEach(() => {
  cleanup()
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
