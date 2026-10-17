// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage/container'
import { STOP_FOCUSABLE_SELECTOR } from '@/utils/focusables'
import { advanceUntil, focusVillage, villageFrame } from './village-walk.test-helper'
import { cycleWithTab, expectFrameFocused } from './village-dialog.test-helper'
import { prepareVillage, resetVillage, villageJa } from './village.test-helper'

// 晴れの天気を敷き、タッチの模擬を持ち越していないことを確かめる(village.test-helper.ts の prepareVillage)
beforeEach(prepareVillage)

// どの describe が何を差し替えても、次のテストへ持ち越さないよう毎回戻す(戻す物は village.test-helper.ts の resetVillage)
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  await resetVillage()
})

// ---- 会話窓の Tab の輪 ----
// E2E が見ていた窓の焦点の断定を、E2E からこの統合テストへ移したもの(ADR 0018 の「統合へ移す」)。
// E2E と同じく利用者に見える物(role・名前・焦点)で断定する。
// 時間は E2E と同じく実時間で進める(rAF・タイマー・performance.now は本物)。差し替えるのは天気(ネットワーク)だけで、
// 歩く・押す・待つは village-walk.test-helper.ts の手順
describe('会話窓の焦点', () => {
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

  test('会話窓は Tab の輪を両端で回し、見出しの Shift+Tab は末尾へ、閉じると村の枠へ焦点を戻す', async () => {
    await renderVillage()
    // 出発の机の前で、話しかけられる吹き出しが出るのを待つ
    await expect
      .poll(() => document.querySelector('[data-village-bubble]'), {
        message: '出発の机の前で吹き出しが出る',
        timeout: 3_000,
      })
      .not.toBeNull()
    villageFrame().focus()
    await expectFrameFocused('開く前の焦点は村の枠')
    await userEvent.keyboard('e')
    const dialog = page.getByRole('dialog')
    const title = dialog.getByRole('heading', { name: text.stops.home.title })
    await expect.element(title, { message: '開いた直後の焦点は見出し' }).toHaveFocus()

    // 見出しは並びの外(-1)。そこから Tab で並びの先頭へ入り、末尾まで進んで回る
    await cycleWithTab(dialog.element(), STOP_FOCUSABLE_SELECTOR)

    // 見出しは並びの外だが先頭と同じに扱い、Shift+Tab で末尾へ回す
    title.element().focus()
    await userEvent.tab({ shift: true })
    const items = dialog.element().querySelectorAll<HTMLElement>(STOP_FOCUSABLE_SELECTOR)
    await expect
      .element(page.elementLocator(items[items.length - 1]), {
        message: '見出しで Shift+Tab を押すと末尾へ回る',
      })
      .toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await expect.element(dialog).not.toBeInTheDocument()
    await expectFrameFocused('閉じると村の枠へ焦点が戻る')
  })
})
