// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// 差し替える物・時間の差し替え方・毎回戻す物は village.test-helper.ts の冒頭の注
import { cleanup, render } from '@testing-library/react'
import { cdp, page, userEvent } from 'vitest/browser'
import VillagePageContainer from '@/components/VillagePage'
import { focusVillage, readCell, runFrames, villageFrame } from './village-walk.test-helper'
import { expectFrameFocused } from './village-dialog.test-helper'
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

// ---- 村の入力と道中の配線(村の枠が受け流すキー) ----
// 村の枠のキーのうち、A/B(Z/X)にしない・何もしない物を、利用者に見える振る舞い(窓・焦点・歩いたか)で確かめる。
// Ctrl・Cmd・Alt を付けた Z/X、押しっぱなしの自動反復の Z、方向キー・話しかけるキー・A/B のどれでもないキー、の 3 つ。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date)で止め、テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// キーは実際の入力(userEvent と CDP の Input)で押す。自動反復の印(repeat)は userEvent では付けられないので CDP で送る。
// 偽の時計・歩いた位置と訪問・ブラウザの環境は、ファイル先頭の afterEach が戻す
describe('村の入力と道中の配線(村の枠が受け流すキー)', () => {
  const setId = villageJa.worldSet.id
  const { text } = villageJa
  const dialog = page.getByRole('dialog')
  const homeHeading = dialog.getByRole('heading', { name: text.stops.home.title })

  // 描く前に偽の時計を入れる(歩行ループが最初に読む performance.now・rAF から偽物にする)。
  // 日付も偽物になるので、途中で昼夜の段階が替わらないよう昼に止める
  beforeEach(() => {
    startVillageClock(PHASE_CLOCKS.day, 'frames')
  })

  // 描いて、起動の覆いが外れたら枠へ焦点を置く(E2E の openVillage)。村は自室の自宅の地点の立ち位置から始まる。PC の 1280×720
  const openVillage = async () => {
    await page.viewport(1280, 720)
    render(<VillagePageContainer {...villageJa} />)
    await focusVillage()
  }

  // 「何も起きない」を見る前に待つフレーム数。窓を開く・閉じるのはキーを押した同じタスクの中で描き直すので、余裕を見て 5 フレーム
  const SETTLE_FRAMES = 5
  const MODIFIERS = ['Control', 'Meta', 'Alt'] as const

  test('Ctrl・Cmd・Alt を付けた Z/X は A/B にせず、付けない Z が話しかけ、付けない X が閉じる', async () => {
    await openVillage()
    for (const modifier of MODIFIERS) {
      await userEvent.keyboard(`{${modifier}>}z{/${modifier}}`)
      await runFrames(SETTLE_FRAMES)
      expect(dialog.query(), `${modifier} を付けた Z では話しかけない`).toBeNull()
    }
    await expectFrameFocused('修飾キー付きの Z の後も焦点は村の枠')
    await userEvent.keyboard('z')
    await expect.element(homeHeading, { message: '付けない Z で机に話しかける' }).toBeVisible()
    for (const modifier of MODIFIERS) {
      await userEvent.keyboard(`{${modifier}>}x{/${modifier}}`)
      await runFrames(SETTLE_FRAMES)
      expect(homeHeading.query(), `${modifier} を付けた X では会話窓を閉じない`).not.toBeNull()
    }
    await userEvent.keyboard('x')
    await expect.element(dialog, { message: '付けない X で閉じる' }).not.toBeInTheDocument()
  })

  test('Z を押したままにした時の自動反復は読まず、押し下ろした最初の 1 回だけが話しかけ、会話中も次の地点へ送らない', async () => {
    // 自動反復の印(repeat)付きの押し下ろしを CDP で送る。テストの描く iframe に焦点を置いてから送る(userEvent も同じことをする)
    const sendZ = (type: 'rawKeyDown' | 'keyUp', autoRepeat = false) =>
      cdp().send('Input.dispatchKeyEvent', {
        type,
        key: 'z',
        code: 'KeyZ',
        windowsVirtualKeyCode: 90,
        nativeVirtualKeyCode: 90,
        autoRepeat,
      })
    await openVillage()
    window.focus()
    villageFrame().focus()
    // 対照の前に、自動反復だけが届いた時(押し下ろしの最初の 1 回は村の外で押した)は話しかけない
    await sendZ('rawKeyDown', true)
    await runFrames(SETTLE_FRAMES)
    expect(dialog.query(), '自動反復の Z では話しかけない').toBeNull()
    await sendZ('keyUp')
    // 押し下ろした最初の 1 回は話しかける(キーが村の枠へ届いていることの対照)
    await sendZ('rawKeyDown')
    await expect.element(homeHeading, { message: '押し下ろした Z で机に話しかける' }).toBeVisible()
    // 押したままにすると自動反復が続く。会話中の A(次へ)にはしない
    await sendZ('rawKeyDown', true)
    await sendZ('rawKeyDown', true)
    await runFrames(SETTLE_FRAMES)
    expect(
      homeHeading.query(),
      '自動反復の Z では次の地点へ送らず、会話窓は自宅のまま'
    ).not.toBeNull()
    await sendZ('keyUp')
  })

  test('方向キー・話しかけるキー・Z/X のどれでもないキーは村の枠では何もせず、Tab は既定どおり焦点を枠から次へ移す', async () => {
    await openVillage()
    await userEvent.keyboard('q')
    await runFrames(SETTLE_FRAMES)
    expect(dialog.query(), 'Q では話しかけない').toBeNull()
    expect(readCell(setId), 'Q では歩かない').toBeNull()
    await expectFrameFocused('Q の後も焦点は村の枠')
    await userEvent.tab()
    await expect
      .poll(() => document.activeElement !== villageFrame(), {
        message: 'Tab は止めず、焦点は枠から次へ移る',
      })
      .toBe(true)
  })
})
