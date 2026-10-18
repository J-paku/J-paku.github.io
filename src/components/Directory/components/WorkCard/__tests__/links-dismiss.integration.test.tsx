// 作品カード(状態コンテナ)の、リンクの覆いの開閉(use-links-overlay)の統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、タップで開いた覆いが Esc とキャプチャ枠の外の押下で閉じ、
// 枠の中の押下では閉じないことを、トリガーの aria-expanded で確かめる。
// タッチ端末かどうかの問い合わせだけを差し替える(directory.test-helper.ts の viewAsTouch)。
// props は一覧の index.fixture.ts が node で組んで provide した作品・文言を inject で受け取る
import { act, cleanup, render, within } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import WorkCard from '@/components/Directory/components/WorkCard'
import {
  cardOf,
  cardProps,
  motionLinkWork,
  prepareEachTest,
  restoreEachTest,
  shotOf,
  ui,
  viewAsTouch,
} from '@/components/Directory/__tests__/directory.test-helper'

// タッチで見て、覆いを開いた状態から始める
const renderOpenOverlay = async () => {
  viewAsTouch()
  render(<WorkCard {...cardProps(motionLinkWork)} />)
  const trigger = within(shotOf(motionLinkWork)).getByRole('button', {
    name: ui.work.openLinks,
  })
  await userEvent.click(trigger)
  await expect.element(trigger).toHaveAttribute('aria-expanded', 'true')
  return trigger
}

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('リンクの覆いの開閉(use-links-overlay)', () => {
  it('タップで開いた覆いは Esc で閉じる', async () => {
    const trigger = await renderOpenOverlay()

    await userEvent.keyboard('{Escape}')
    await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('タップで開いた覆いは、キャプチャ枠の中を押しても閉じず、枠の外を押すと閉じる', async () => {
    const trigger = await renderOpenOverlay()

    // 押下の始まり(pointerdown)だけを送る。クリックまで送るとトリガー自身の開閉が混ざる
    act(() => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    // 枠の外(同じカードの題字)を押す
    await userEvent.click(within(cardOf(motionLinkWork)).getByRole('heading', { level: 3 }))
    await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
