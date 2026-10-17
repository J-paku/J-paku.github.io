// 会話窓(StopModal)を直接描き、開いた時と外した時の焦点、次へ・一覧への案内・閉じるの操作と Esc、Tab の輪を見る。
// 知らせを受けて次の地点へ向かう・窓を外すのは呼び出し側(村の画面)で、閉じた後に村の枠へ焦点が戻るのは、画面全体を描く stop-tab-ring が見る
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { inject } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import StopModal from '@/components/VillagePage/components/Village/components/StopModal/container'
import { STOP_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import { cycleWithTab, placeOpener } from '../village-dialog.test-helper'
import { stopProps, stopTextOf } from './stop-modal.test-helper'

const { text, listHref } = inject('villageJa')

// 村の枠と同じく、窓を重ねる大きさのある箱
const renderInBox = (modal: ReactNode) =>
  render(<div style={{ position: 'relative', width: 480, height: 640 }}>{modal}</div>)
const handlers = () => ({ onNext: vi.fn(), onClose: vi.fn() })

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

describe('会話窓の操作と焦点', () => {
  const dialog = page.getByRole('dialog')
  const home = stopTextOf('home')

  test('開いた会話窓は見出しへ焦点を置き、外すと開く前の所へ焦点を戻す', async () => {
    const opener = placeOpener()
    const { unmount } = renderInBox(
      <StopModal {...stopProps('home', handlers(), { returnTo: { current: opener } })} />
    )
    await expect
      .element(dialog.getByRole('heading', { name: home.title }), {
        message: '開いた直後の焦点は見出し',
      })
      .toHaveFocus()

    unmount()
    await expect
      .element(page.elementLocator(opener), { message: '外すと開く前の所へ戻す' })
      .toHaveFocus()
  })

  test('次の地点がある時は次へのボタンを出し、押すと次へ進む知らせを呼ぶ', async () => {
    const calls = handlers()
    renderInBox(<StopModal {...stopProps('home', calls)} />)
    expect(
      dialog.getByRole('link', { name: home.next, exact: true }).query(),
      '作品一覧への案内は出さない'
    ).toBeNull()
    await dialog.getByRole('button', { name: home.next, exact: true }).click()
    expect(calls.onNext, '次へ進む知らせ').toHaveBeenCalledTimes(1)
    expect(calls.onClose, '閉じる知らせは呼ばない').not.toHaveBeenCalled()
  })

  test('コースの最後の地点では、次へのボタンの代わりに作品一覧への案内を出す', async () => {
    const journey = stopTextOf('journey')
    renderInBox(<StopModal {...stopProps('journey', handlers(), { hasNext: false })} />)
    await expect
      .element(dialog.getByRole('link', { name: journey.next, exact: true }))
      .toHaveAttribute('href', listHref)
    expect(
      dialog.getByRole('button', { name: journey.next, exact: true }).query(),
      '次の地点へ進むボタンは無い'
    ).toBeNull()
  })

  test('閉じるボタンでも Esc でも閉じる知らせを呼ぶ', async () => {
    const calls = handlers()
    renderInBox(<StopModal {...stopProps('home', calls)} />)
    await dialog.getByRole('button', { name: text.close, exact: true }).click()
    expect(calls.onClose, '閉じるボタンで閉じる知らせ').toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(calls.onClose, 'Esc で閉じる知らせ').toHaveBeenCalledTimes(2)
    expect(calls.onNext, '次へは進まない').not.toHaveBeenCalled()
  })

  test('会話窓の中の Tab は窓の中の操作を両端で回り、見出しの Shift+Tab は末尾へ回る', async () => {
    renderInBox(<StopModal {...stopProps('home', handlers())} />)
    const title = dialog.getByRole('heading', { name: home.title })
    await expect.element(title).toHaveFocus()
    // 見出しは並びの外(-1)。そこから Tab で並びの先頭へ入り、末尾まで進んで回る
    await cycleWithTab(dialog.element(), STOP_FOCUSABLE_SELECTOR)

    title.element().focus()
    await userEvent.tab({ shift: true })
    const items = dialog.element().querySelectorAll<HTMLElement>(STOP_FOCUSABLE_SELECTOR)
    await expect
      .element(page.elementLocator(items[items.length - 1]), {
        message: '見出しで Shift+Tab を押すと末尾へ回る',
      })
      .toHaveFocus()
  })
})
