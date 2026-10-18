// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import { STOP_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import {
  FRAME_MS,
  advanceUntil,
  focusVillage,
  runFor,
  tapHeld,
  walk,
} from './village-walk.test-helper'
import { PHASE_CLOCKS, startVillageClock } from './village-time.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 村の入力と道中の配線(話しかける・会話窓のキー) ----
// E2E から移した歩く・待つ・釣り・傘・飛ぶの検査(idle-loop・fishing・umbrella・flight-* の各ファイル)が通らないフックの分岐のうち、話せる相手がいない時の一言・
// 会話窓を閉じるキー・押したまま開き直した会話窓の焦点を、利用者に見える振る舞いで確かめる。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(話しかける・会話窓のキー)', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa

  // 描いて、起動の覆いが外れたら枠へ焦点を置く(E2E の openVillage)。既定は E2E と同じ PC の 1280×720
  const openVillage = async (width = 1280, height = 720) => {
    await page.viewport(width, height)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
  }

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  const dialog = page.getByRole('dialog')

  test('話せる相手がいない所で話しかけた時の一言は、2.5 秒経つと消える', async () => {
    await openVillage()
    // 開始地点 (4,4) から 1 マス下は地点の立ち位置ではない
    expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
    const hint = () =>
      [...document.querySelectorAll('[data-village-bubble-kind="thought"]')].find(bubble =>
        (bubble.textContent ?? '').includes(text.noTarget)
      ) ?? null
    await userEvent.keyboard('e')
    await expect.poll(hint, { message: '話せる相手がいない時の一言' }).not.toBeNull()
    await runFor(2_400)
    expect(hint(), '2.5 秒より前は出ている').not.toBeNull()
    await runFor(FRAME_MS * 8)
    expect(hint(), '2.5 秒経つと消える').toBeNull()
  })

  test('会話窓が開いている間は方向キー以外のキーでは閉じず、X で閉じる', async () => {
    await openVillage()
    await userEvent.keyboard('e')
    await expect.element(dialog.getByRole('heading', { name: text.stops.home.title })).toBeVisible()
    await userEvent.keyboard('q')
    await runFor(FRAME_MS * 2)
    expect(dialog.query(), 'Q では閉じない').not.toBeNull()
    await userEvent.keyboard('x')
    await expect.element(dialog).not.toBeInTheDocument()
  })

  test('会話窓で下を押したまま閉じて開き直すと、本文が窓に収まっていても押し直すまで焦点を操作へ渡さない', async () => {
    await openVillage()
    const title = dialog.getByRole('heading', { name: text.stops.home.title })
    await userEvent.keyboard('e')
    await expect.element(title).toHaveFocus()
    const panel = dialog.element().querySelector('[data-village-panel]')
    if (panel === null) throw new Error('会話窓の本文が無い')
    expect(panel.scrollHeight, '本文が窓に収まっている(送る余地が無い)').toBeLessThanOrEqual(
      panel.clientHeight
    )
    const firstAction = () => dialog.element().querySelector(STOP_FOCUSABLE_SELECTOR)
    // 収まっているので、下を押した瞬間に先頭の操作へ渡る
    await userEvent.keyboard('{ArrowDown>}')
    await advanceUntil(
      () => document.activeElement === firstAction(),
      '押した瞬間に先頭の操作へ渡る'
    )
    // 下を押したまま X で閉じ、E で開き直す
    await userEvent.keyboard('x')
    await expect.element(dialog).not.toBeInTheDocument()
    await userEvent.keyboard('e')
    await expect.element(title).toHaveFocus()
    await runFor(FRAME_MS * 10)
    expect(document.activeElement, '開く前から押していた下では見出しに留まる').toBe(title.element())
    // 離したのを 1 フレームで読ませてから押し直すと渡る
    await userEvent.keyboard('{/ArrowDown}')
    await runFor(FRAME_MS * 2)
    await tapHeld('ArrowDown')
    await advanceUntil(() => document.activeElement === firstAction(), '押し直すと先頭の操作へ渡る')
  })
})
