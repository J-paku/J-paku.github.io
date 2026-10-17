// 技術チップを直接描き、タッチの疑似ホバーでは開閉せず、タップでは開くことを見る
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import TechChipPopover from '@/components/Story/components/TechChipPopover/container'
import { expectChip } from '../chip-popover.test-helper'
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
