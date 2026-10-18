// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import { advanceUntil, focusVillage, runFrames, villageFrame } from './village-walk.test-helper'
import { expectFrameFocused } from './village-dialog.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- Z/X(画面の A/B)の行き先 ----
// tests/journey.spec.ts が見ている窓の中の操作のうち、Z/X の行き先を決めるフック(use-village-buttons)の分岐を統合で通すもの。
// journey の行き先はこの段では決めていないので、journey はそのまま残す(ADR 0018)。
// E2E と同じく利用者に見える物(role・名前・焦点)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順
describe('Z/X(画面の A/B)', () => {
  const { text } = villageJa

  // 画面は既定で PC(E2E の既定と同じ 1280×720)
  beforeEach(async () => {
    await page.viewport(1280, 720)
  })

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

  test('Z(画面の A)は歩いている時は話しかけ、会話中は次の地点へ進み、X(画面の B)は歩いている時は何もせず会話中は閉じる', async () => {
    await renderVillage()
    await expect
      .poll(() => document.querySelector('[data-village-bubble]'), {
        message: '出発の机の前で吹き出しが出る',
        timeout: 3_000,
      })
      .not.toBeNull()
    villageFrame().focus()
    const dialog = page.getByRole('dialog')
    // 歩いている時の X は閉じる窓が無いので何もしない
    await userEvent.keyboard('x')
    await runFrames(SETTLE_FRAMES)
    expect(
      document.querySelector('[role="dialog"]'),
      '歩いている時の X では窓が開かない'
    ).toBeNull()
    await expectFrameFocused('X の後も焦点は村の枠')
    // 歩いている時の Z は話しかける(E と同じ)
    await userEvent.keyboard('z')
    await expect
      .element(dialog.getByRole('heading', { name: text.stops.home.title }), {
        message: 'Z で机に話しかけ、会話窓の見出しに焦点がある',
      })
      .toHaveFocus()
    // 焦点がボタンでない(見出しの)時の Z は、窓の「次へ」と同じ行き先へ進む
    await userEvent.keyboard('z')
    await expect
      .element(dialog.getByRole('heading', { name: text.stops.meishi.title }), {
        message: '会話中の Z で次の地点(名刺工房)へ進む',
        timeout: 10_000,
      })
      .toBeVisible()
    // 会話中の X は窓を閉じる
    await userEvent.keyboard('x')
    await expect.element(dialog).not.toBeInTheDocument()
  })
})
