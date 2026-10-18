// 作品カード(状態コンテナ)の、詳細の開閉(use-detail-open)の統合テスト(Vitest Browser Mode)。
// カードを実際の Chromium で、フック・子と一緒に描き(ADR 0016)、到着した URL のハッシュで詳細の開閉の始まりが決まることと、
// トグルで閉じると詳細が操作から外れることを、利用者に見える形(role・名前・aria-*・inert)で確かめる。
// props は一覧の index.fixture.ts が node で組んで provide した作品・文言を inject で受け取る
import { cleanup, render, within } from '@testing-library/react'
import { userEvent } from 'vitest/browser'
import WorkCard from '@/components/Directory/components/WorkCard'
import {
  cardOf,
  cardProps,
  detailWork,
  pickWork,
  prepareEachTest,
  restoreEachTest,
  ui,
  works,
} from '@/components/Directory/__tests__/directory.test-helper'

// トグルが aria-controls で指す詳細の領域
const detailRegionOf = (toggle: HTMLElement): HTMLElement => {
  const region = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
  if (region === null) throw new Error('トグルの aria-controls が指す要素が無い')
  return region
}

// inert の祖先に入っていれば、操作からも読み上げからも外れている
const isInert = (element: HTMLElement) => element.closest('[inert]') !== null

beforeEach(prepareEachTest)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境のまま走るように)
  cleanup()
  await restoreEachTest()
})

describe('詳細の開閉(use-detail-open)', () => {
  it('#slug 付きで到着すると詳細が最初から開いていて、トグルを押すと閉じて操作から外れる', async () => {
    window.history.replaceState(null, '', `#${detailWork.slug}`)
    render(<WorkCard {...cardProps(detailWork)} />)

    const toggle = within(cardOf(detailWork)).getByRole('button', { name: ui.work.hideDetail })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(isInert(detailRegionOf(toggle))).toBe(false)

    await userEvent.click(toggle)
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle.textContent).toBe(ui.work.showDetail)
    expect(isInert(detailRegionOf(toggle))).toBe(true)
  })

  it('ハッシュが無ければ詳細は閉じたまま始まる', () => {
    render(<WorkCard {...cardProps(detailWork)} />)

    const toggle = within(cardOf(detailWork)).getByRole('button', { name: ui.work.showDetail })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(isInert(detailRegionOf(toggle))).toBe(true)
  })

  it('別の作品の #slug で到着したときは、詳細は閉じたまま始まる', () => {
    const otherWork = pickWork(
      works,
      '詳細を持つ作品とは別の',
      work => work.slug !== detailWork.slug
    )
    window.history.replaceState(null, '', `#${otherWork.slug}`)
    render(<WorkCard {...cardProps(detailWork)} />)

    const toggle = within(cardOf(detailWork)).getByRole('button', { name: ui.work.showDetail })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(isInert(detailRegionOf(toggle))).toBe(true)
  })
})
