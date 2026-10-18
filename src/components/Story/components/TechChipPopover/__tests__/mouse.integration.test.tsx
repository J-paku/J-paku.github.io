// 技術チップ(TechChipPopover。開閉を持つ状態のコンテナ)を直接描き、マウスのホバーで開閉し、押すのは開く専用であることを見る
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import TechChipPopover from '@/components/Story/components/TechChipPopover'
import { expectChip } from '@/components/Story/__tests__/chip-popover.test-helper'
import '@/styles/tokens.css'

const { story, locale } = inject('storyJa')
const chip = story.scenes[0].chips[0]

const renderChip = () => {
  render(<TechChipPopover chip={chip} locale={locale} />)
  return page.getByRole('button', { name: chip.name, exact: true })
}

beforeEach(async () => {
  await page.viewport(1280, 900)
})

afterEach(() => {
  cleanup()
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
