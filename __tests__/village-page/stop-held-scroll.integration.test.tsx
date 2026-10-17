// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { STOP_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import {
  FRAME_MS,
  advanceUntil,
  focusVillage,
  runFor,
  tapHeld,
  villageFrame,
} from './village-walk.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 会話窓の本文送り ----
// tests/journey.spec.ts が見ている窓の中の操作のうち、本文送りのフック(use-held-scroll)の分岐を統合で通すもの。
// journey の行き先はこの段では決めていないので、journey はそのまま残す(ADR 0018)。
// E2E と同じく利用者に見える物(role・名前・焦点・送り位置)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順
describe('会話窓の本文送り', () => {
  const { text } = villageJa

  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

  // DOM から 1 つ引く。無ければ前提が崩れているのでその場で落とす
  const queryOne = (selector: string, from: ParentNode = document): HTMLElement => {
    const element = from.querySelector<HTMLElement>(selector)
    if (element === null) throw new Error(`${selector} が描かれていない`)
    return element
  }

  // 村の根。data-phase に今の段階が、インラインの --cols・--rows(Village)と --cell・--band(useStageScale)に寸法が載る
  const root = () => {
    const element = villageFrame().closest<HTMLElement>('[data-phase]')
    if (element === null) throw new Error('村の根(data-phase)が描かれていない')
    return element
  }

  // 村を描き、起動の覆いが外れたら枠へ焦点を置き(E2E の openVillage)、useStageScale が舞台の実測を --cell に書くまで待つ。
  // CSS の既定値だけでも近い寸法になるため、インラインの値で見る。実際のコンテンツでは作れない場合だけ、props を変えた版を overrides で渡す
  const renderVillage = async (overrides: Partial<typeof villageJa> = {}) => {
    render(<VillagePageContainer {...villageJa} {...overrides} />)
    await focusVillage()
    await advanceUntil(
      () => root().style.getPropertyValue('--cell') !== '',
      'useStageScale が --cell を書いた'
    )
  }

  // 「段階が変わらない」を見る前に待つフレーム数。段階を変える処理(シートの decode を待ってから setState)は、
  // 走れば 2 フレーム以内に画面へ届いた(2026-10-15、取消しで時刻を決めてしまう欠陥を入れて実測)ので、余裕を見て 5 フレーム
  const SETTLE_FRAMES = 5

  test('会話窓は下の押しっぱなしで本文を送り切ってから操作へ焦点を渡し、上で 1 つずつ戻って見出しへ帰り、本文も巻き戻る', async () => {
    // 本文が窓より長くなる狭い画面で開く
    await page.viewport(390, 664)
    await renderVillage()
    await userEvent.keyboard('e')
    const dialog = page.getByRole('dialog')
    const title = dialog.getByRole('heading', { name: text.stops.home.title })
    await expect.element(title, { message: '開いた直後の焦点は見出し' }).toHaveFocus()
    const panel = queryOne('[data-village-panel]', dialog.element())
    expect(panel.scrollHeight, '本文が窓より長い(送る余地がある)').toBeGreaterThan(
      panel.clientHeight
    )
    const items = Array.from(
      dialog.element().querySelectorAll<HTMLElement>(STOP_FOCUSABLE_SELECTOR)
    )
    expect(items.length, '焦点を移せる操作が 2 つ以上ある').toBeGreaterThanOrEqual(2)
    const expectFocusOn = (element: Element, message: string) =>
      expect.element(page.elementLocator(element), { message }).toHaveFocus()

    // 下を押し続けると本文が送られ、送り切ったフレームで先頭の操作へ焦点が渡る
    await userEvent.keyboard('{ArrowDown>}')
    await expect
      .poll(() => panel.scrollTop, { message: '押している間は本文が送られる' })
      .toBeGreaterThan(0)
    await expectFocusOn(items[0], '送り切ると先頭の操作へ焦点が移る')
    // 押し続けても次の操作へは流れない(前へ渡すのは押した瞬間だけ)
    await runFor(FRAME_MS * SETTLE_FRAMES)
    expect(document.activeElement, '押し続けても先頭の操作に留まる').toBe(items[0])
    await userEvent.keyboard('{/ArrowDown}')

    // 押し直すたびに下は 1 つ先へ、上は 1 つ前へ
    await tapHeld('ArrowDown')
    await expectFocusOn(items[1], '下をもう 1 回で次の操作へ')
    await tapHeld('ArrowUp')
    await expectFocusOn(items[0], '上 1 回で 1 つ前へ')
    // 先頭から上は本文(見出し)へ戻り、押し続ければ本文が先頭まで巻き戻る
    await userEvent.keyboard('{ArrowUp>}')
    await expectFocusOn(title.element(), '先頭の操作から上で見出しへ戻る')
    await expect
      .poll(() => panel.scrollTop, {
        message: '上を押し続けると本文が先頭まで巻き戻る',
        timeout: 5_000,
      })
      .toBe(0)
    await userEvent.keyboard('{/ArrowUp}')
  })

  test('本文が窓に収まる会話窓では、下を押した瞬間に先頭の操作へ焦点が渡る', async () => {
    await renderVillage()
    await userEvent.keyboard('e')
    const dialog = page.getByRole('dialog')
    await expect.element(dialog.getByRole('heading', { name: text.stops.home.title })).toHaveFocus()
    const panel = queryOne('[data-village-panel]', dialog.element())
    expect(panel.scrollHeight, '本文が窓に収まっている(送る余地が無い)').toBeLessThanOrEqual(
      panel.clientHeight
    )
    // 送る本文が無いので、押した瞬間(押し直し)に先頭の操作へ渡す
    await tapHeld('ArrowDown')
    await expect
      .element(page.elementLocator(queryOne(STOP_FOCUSABLE_SELECTOR, dialog.element())), {
        message: '下を押した瞬間に先頭の操作へ焦点が移る',
      })
      .toHaveFocus()
  })
})
