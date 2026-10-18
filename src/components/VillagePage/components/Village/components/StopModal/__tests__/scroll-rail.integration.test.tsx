// 会話窓(StopModal)を直接描き、本文が窓より長い時だけ自前の縦棒を出してつまみを本文の送り位置に合わせることと、
// スティック・方向キーの押しっぱなし(村の入力が ref へ書く向き)で本文を送ることを見る。
// 窓の大きさは重ねる箱(村では枠)の大きさで決まるので、本文があふれるかどうかは箱の高さで作る。
// 村の画面の中で、送り切った後に操作へ焦点を渡す流れは、画面全体を描く stop-held-scroll が見る
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import type { Direction } from '@content/types/world'
import StopModal from '@/components/VillagePage/components/Village/components/StopModal/container'
// 部品と同じ CSS Modules を import すれば、部品と同じクラス名が引ける
import styles from '@/components/VillagePage/components/Village/components/StopModal/stop-modal.module.css'
import { measureScrollThumb } from '@/components/VillagePage/components/Village/components/StopModal/utils/measure-scroll-thumb'
import {
  FRAME_MS,
  advanceUntil,
  runFor,
} from '@/components/VillagePage/__tests__/village-walk.test-helper'
import { stopPanel, stopProps, stopTextOf } from './stop-modal.test-helper'

// 村の枠と同じく、窓を重ねる大きさのある箱。低い箱では経歴碑の本文が窓からあふれる
const renderInBox = (modal: ReactNode, height: number) =>
  render(<div style={{ position: 'relative', width: 480, height }}>{modal}</div>)
const LOW_BOX = 300
const TALL_BOX = 640
const handlers = () => ({ onNext: vi.fn(), onClose: vi.fn() })

// 「動かない」を見る前に待つフレーム数。押しっぱなしの送りは 1 フレームごとに進むので、5 フレーム待てば動いていれば分かる
const SETTLE_FRAMES = 5

const rail = (dialog: Element) => dialog.querySelector<HTMLElement>(`.${styles.rail}`)
// 縦棒に書くつまみの位置と長さ(コンテナが割合を % に直した文字列)
const railVars = (element: HTMLElement) => ({
  top: element.style.getPropertyValue('--thumb-top'),
  size: element.style.getPropertyValue('--thumb-size'),
})
// 本文の今の送り位置から求めたつまみの位置と長さ(% の文字列。小数 2 桁)
const expectedVars = (panel: HTMLElement) => {
  const { scrollTop, scrollHeight, clientHeight } = panel
  const thumb = measureScrollThumb({ scrollTop, scrollHeight, clientHeight })
  return { top: `${(thumb.top * 100).toFixed(2)}%`, size: `${(thumb.size * 100).toFixed(2)}%` }
}

beforeEach(async () => {
  // E2E(Playwright の Desktop Chrome)と同じ画面の大きさ
  await page.viewport(1280, 720)
})

afterEach(() => {
  cleanup()
})

describe('本文の縦棒と押しっぱなしの送り', () => {
  const dialog = page.getByRole('dialog')

  test('本文が窓より長い時は縦棒を出し、つまみを見えている割合の長さにして、本文を送るとつまみを下げる', async () => {
    renderInBox(<StopModal {...stopProps('monument', handlers())} />, LOW_BOX)
    const panel = stopPanel(dialog.element())
    expect(panel.scrollHeight, '前提: 本文が窓より長い').toBeGreaterThan(panel.clientHeight + 1)
    await advanceUntil(() => rail(dialog.element()) !== null, '本文があふれると縦棒を出す')
    const bar = rail(dialog.element())!
    expect(railVars(bar), '先頭ではつまみが上端で、長さは見えている割合').toEqual(
      expectedVars(panel)
    )
    expect(railVars(bar).top).toBe('0.00%')

    // 本文を末尾まで送る
    panel.scrollTop = panel.scrollHeight
    await expect
      .poll(() => railVars(bar), { message: '送った位置につまみを合わせる' })
      .toEqual(expectedVars(panel))
    expect(Number.parseFloat(railVars(bar).top), '末尾ではつまみが下がっている').toBeGreaterThan(0)
  })

  test('本文が窓に収まる時は縦棒を出さない', async () => {
    // 釣りの確認窓のように、主張だけの短い本文
    const stop = { ...stopTextOf('home'), proof: '', detail: '', hook: '' }
    renderInBox(<StopModal {...stopProps('home', handlers(), { stop })} />, TALL_BOX)
    const panel = stopPanel(dialog.element())
    expect(panel.scrollHeight, '前提: 本文が窓に収まる').toBeLessThanOrEqual(panel.clientHeight)
    await runFor(FRAME_MS * SETTLE_FRAMES)
    expect(rail(dialog.element()), '縦棒は出さない').toBeNull()
  })

  test('押しっぱなしの下の向きで本文を送り、離すと送りを止める', async () => {
    // 押しっぱなしの向きは村の入力が ref へ書き、窓は読むだけ。ここではテストが書く
    const scrollHeldRef: { current: Direction | null } = { current: null }
    renderInBox(<StopModal {...stopProps('monument', handlers(), { scrollHeldRef })} />, LOW_BOX)
    const panel = stopPanel(dialog.element())
    await expect
      .element(dialog.getByRole('heading', { name: stopTextOf('monument').title }))
      .toHaveFocus()

    scrollHeldRef.current = 'down'
    // 向きが変わった知らせは来ず、窓はキー・ポインタの入力を合図に読み直す。合図には向きを持たない Shift を押す
    await userEvent.keyboard('{Shift}')
    await advanceUntil(() => panel.scrollTop > 0, '押している間は本文を送る')

    scrollHeldRef.current = null
    await userEvent.keyboard('{Shift}')
    await runFor(FRAME_MS * 2)
    const stopped = panel.scrollTop
    await runFor(FRAME_MS * SETTLE_FRAMES)
    expect(panel.scrollTop, '離すと送りを止める').toBe(stopped)
  })
})
