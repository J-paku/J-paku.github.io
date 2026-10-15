// 村の統合テスト(Vitest Browser Mode)。村の画面を実際の Chromium で、フック・子と一緒に描く(ADR 0016)。
// happy-dom は配置を計算せず ResizeObserver.observe() も実装が無いので、寸法に頼る振る舞いはここで見る。
// 差し替えるのはネットワーク(天気の通信・段階のシートの絵の取得)と時間だけ。レイアウト・ResizeObserver・入力は本物を使う。
// 時間の差し替え方は describe ごとに違う(掛け方は village-time.test-helper.ts の startVillageClock):
//   - 「歩く・待つ・釣り・傘・飛ぶ」は rAF・performance.now・タイマー・Date を偽の時計に載せ、テストが 1 フレーム(16ms)ずつ進める
//   - 「画面の大きさ・窓・時計・昼夜」は rAF・タイマー・performance.now を本物のまま使い、段階を決めるテストだけ Date を止める
//     (開いたまま時間帯が替わるテストは Date と setInterval を止め、テストが進める)
//   - その間にある画面の大きさのテストは時間を差し替えない
// 偽の時計・差し替えた通信と Image・CDP で替えたブラウザの環境・卓上時計のストア・保存した位置は、下の afterEach が毎回戻す
// (タッチの模擬を切った後の pointer・hover だけは戻り切らない。village-walk.test-helper.ts の resetEmulation の注)
import { cleanup, render } from '@testing-library/react'
import { inject } from 'vitest'
import { page } from 'vitest/browser'
import { clearVillageProgress } from '@/lib/preferences'
import VillagePageContainer from './container'
import { userEvent } from 'vitest/browser'
import {
  HOLD_MS,
  SETTLE_MS,
  advanceUntil,
  emulateTouch,
  expectLoopIdle,
  focusVillage,
  loopState,
  mouse,
  playerOnScreen,
  readCell,
  resetEmulation,
  runFor,
  stubWeather,
  tap,
  villageFrame,
  walk,
} from './village-walk.test-helper'
import { recordAttribute } from './village-walk-record.test-helper'
import { PHASE_CLOCKS, startVillageClock } from './village-time.test-helper'

const villageJa = inject('villageJa')

// 利用者に見える枠の大きさ(px)。操作帯のスティックも role=application なので、枠の読み上げ名
// (use-village.ts の hintLabel。ポインタが細かい端末では text.hint)で枠だけを指す
const frameSize = () => {
  const { width, height } = page
    .getByRole('application', { name: villageJa.text.hint })
    .element()
    .getBoundingClientRect()
  return { width, height }
}

// 天気(Open-Meteo)にだけ晴れを返し、ほかの問い合わせは断る。テストが外へ出ていく道を残さない。
// 雨・雪・取得失敗を見るテストは、テストの中で stubWeather を敷き直して上書きする
beforeEach(() => {
  stubWeather('clear')
})

// どの describe が何を差し替えても、次のテストへ持ち越さないようここで毎回戻す
afterEach(async () => {
  // 先に外してから環境を戻す(effect の後始末が差し替えた環境と偽の時計のまま走り、積まれたタイマーを本物の時計へ持ち越さないように)
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // CDP で替えたブラウザの環境(動きを控える設定・タッチ)
  await resetEmulation()
  // 村が本物の sessionStorage へ書いた位置と訪問を消し、何も保存していない状態へ戻す(消し方の正本は preferences.ts)。
  // 歩いた・話した後に残すと、同じページで後に描く村がその位置・訪問から始まる
  clearVillageProgress(villageJa.worldSet.id)
})

// ---- 歩く・待つ・釣り・傘・飛ぶ ----
// E2E が見ていた歩行ループの眠りと目覚め・池での釣り・雨の日の傘・自動移動の直線飛行を、E2E からこの統合テストへ移したもの
// (ADR 0016 の「統合へ移す」)と、
// それが通らないフックの分岐を確かめる検査(各 describe の末尾と「村の入力と道中の配線」)。
// 時計は Vitest の偽の時計(rAF・performance.now・タイマー・Date。E2E の page.clock と同じく時間として替える)で止め、
// テストが 1 フレーム(16ms)ずつ進める(手順は village-walk.test-helper.ts)。
// 歩く・押すは実際のキー入力(userEvent)、スティックと舞台を押すのは CDP の Input で行う。
// 偽の時計・歩いた位置と訪問・ブラウザの環境(動きを控える・タッチ)は、ファイル先頭の afterEach が戻す
describe('歩く・待つ・釣り・傘・飛ぶ', () => {
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

  describe('歩行ループの眠りと目覚め', () => {
    // 眠っていても 1 秒で頼んでよい rAF の数。吹き出しの位置合わせ(rAF 2 回)のような一度きりの分の遊び
    const IDLE_RAF_ALLOWANCE = 2

    // 1 秒のあいだにアプリが頼んだ rAF の数。回っていれば約 60、眠っていれば 0。
    // rAF は偽の時計のものをそのまま呼び通し、数えるだけにする
    const rafRequestsInOneSecond = async () => {
      const requests = vi.spyOn(window, 'requestAnimationFrame')
      await runFor(1_000)
      const count = requests.mock.calls.length
      requests.mockRestore()
      return count
    }

    test('止まっている間は歩行ループが眠り、最初の方向キー 1 回で 1 マス歩く', async () => {
      await openVillage()
      await expectLoopIdle()
      expect(await rafRequestsInOneSecond(), '眠っている間に頼んだ rAF').toBeLessThanOrEqual(
        IDLE_RAF_ALLOWANCE
      )
      expect(loopState()).toBe('idle')
      // 起きて眠り直すまでの印の移り変わりを控える。一瞬だけの running も取りこぼさない
      const observed = recordAttribute(villageFrame(), 'data-village-loop')
      // 開いた直後は開始地点 (4,4) にいて、まだ何も保存していない
      expect(readCell(setId)).toBeNull()
      // 眠っている所へ押した最初の 1 回が読まれ、1 マス下へ着く(起こし忘れると 1 歩も動かない)
      expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
      expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
      // 歩き終えたらまた眠る。途中で一度は起きていた
      await expectLoopIdle()
      expect(observed.map(mark => mark.value).join(','), '起きて眠り直すまでの印').toMatch(
        /^running(,.+)?,idle$/
      )
    })

    test('会話窓を開いている間は 2 本のループとも眠り、閉じた後の最初の入力で歩き出す', async () => {
      // PC 原寸の枠(640×576)だと自宅の本文が窓に収まり、送る余地が残らないことがある。
      // 高さを詰めて枠ごと縮め、本文を必ずあふれさせる(E2E と同じ寸法)
      await openVillage(1280, 480)
      const dialog = page.getByRole('dialog')
      await userEvent.keyboard('e')
      await expect
        .element(dialog.getByRole('heading', { name: text.stops.home.title }))
        .toHaveFocus()
      // 窓が開いている間は歩かないので歩行ループは眠り、本文送りのループも押すまでは眠る
      await expectLoopIdle()
      expect(
        await rafRequestsInOneSecond(),
        '窓を開いて眠っている間に頼んだ rAF'
      ).toBeLessThanOrEqual(IDLE_RAF_ALLOWANCE)
      // 眠っていた本文送りが下キーで起き、本文が送られる
      const panel = dialog.element().querySelector('[data-village-panel]')
      if (panel === null) throw new Error('会話窓の本文が無い')
      await userEvent.keyboard('{ArrowDown>}')
      await advanceUntil(() => panel.scrollTop > 0, '下キーで本文が送られる')
      await userEvent.keyboard('{/ArrowDown}')
      await dialog.getByRole('button', { name: text.close }).click()
      await expect.element(dialog).not.toBeInTheDocument()
      // 閉じて錠が外れた後も、眠っている所へ押した最初の 1 回で歩く
      await expectLoopIdle()
      expect(await walk(setId, 'ArrowDown', 1)).toBe(1)
      expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
    })

    test('眠っている間に画面の大きさが変わると、起きて新しいマス寸法で描き直す', async () => {
      await openVillage()
      // 町ではカメラが動く(自宅前 (14,12) で原点 (10,8))ので、人物と世界の層の両方を描き直したかを見られる
      expect(await walk(setId, 'ArrowDown', 3)).toBe(3)
      expect(readCell(setId)).toEqual({ worldId: 'town', cell: { x: 14, y: 12 } })
      // ワープの後も、新しいタイルが載ってカメラが追い付けば眠る
      await expectLoopIdle()
      const before = playerOnScreen()
      // カメラは人物を枠の左から 5 番目・上から 5 番目のマスへ置く
      expect(before.x).toBeCloseTo(4, 1)
      expect(before.y).toBeCloseTo(4, 1)
      // 高さで決まる 50px 以下のマスへ縮める(PC 原寸は 64px)
      await page.viewport(800, 450)
      await advanceUntil(() => playerOnScreen().cell < before.cell, '小さいマス寸法へ描き直す')
      // 描き直さなければ人物も世界の層も 64px 基準の位置に残り、5.1 マス目や 1.2 マス目を指す
      const nearCell4 = (value: number) => Math.abs(value - 4) < 0.05
      await advanceUntil(
        () => nearCell4(playerOnScreen().x) && nearCell4(playerOnScreen().y),
        '縮めた後も人物は左から 5 番目・上から 5 番目のマス'
      )
      await expectLoopIdle()
    })

    describe('縦持ちのスマートフォン', () => {
      test('眠っている間にスティックを倒した 1 回と、タップした 1 回でそれぞれ歩く', async () => {
        // E2E の isMobile・hasTouch に当たるタッチ端末(pointer: coarse)にしてから描く
        await emulateTouch()
        await openVillage(390, 664)
        await expectLoopIdle()
        const stick = page
          .getByRole('application', { name: text.joystick })
          .element()
          .getBoundingClientRect()
        const x = stick.x + stick.width / 2
        const y = stick.y + stick.height / 2
        // 下へ倒して 1 マス分だけ押し、中央へ戻して離す
        await mouse.move(x, y, false)
        await mouse.down(x, y)
        await mouse.move(x, y + 30, true)
        await runFor(HOLD_MS)
        await mouse.move(x, y, true)
        await mouse.up(x, y)
        await runFor(SETTLE_MS)
        expect(readCell(setId)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
        await expectLoopIdle()
        // 眠っている所で 1 マス上 (4,4) を叩くと、そこへ歩いて戻る。部屋は枠に収まりカメラは動かない
        const { frame, cell, x: column, y: row } = playerOnScreen()
        await tap(frame.x + (column + 0.5) * cell, frame.y + (row - 0.5) * cell)
        const backHome = () => JSON.stringify(readCell(setId))
        await advanceUntil(
          () => backHome() === JSON.stringify({ worldId: 'room', cell: { x: 4, y: 4 } }),
          '叩いた 1 マス上へ歩いて戻る'
        )
        await expectLoopIdle()
      })
    })
  })
})

test('画面の大きさを変えると、枠を新しい整数のマス寸法で 10×9 マスに描き直す', async () => {
  // 前提: ブラウザの時間帯は設定(vitest.integration.config.ts)どおり UTC。機器の時間帯に左右させない
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone, 'ブラウザの時間帯は UTC').toBe('UTC')

  await page.viewport(1280, 720)
  render(<VillagePageContainer {...villageJa} />)
  // 横長の PC: 幅なら 128px、高さなら 80px のマスが取れるが、原寸の上限 64px で止まる
  await expect
    .poll(frameSize, { message: '1280×720 では 64px のマスで 640×576' })
    .toEqual({ width: 640, height: 576 })

  await page.viewport(600, 900)
  // 縦長: 幅で決まり 600 / 10 列 = 60px。描き直さないと 64px のマスの 640×576 のまま残る
  await expect
    .poll(frameSize, { message: '600×900 では 60px のマスで 600×540' })
    .toEqual({ width: 600, height: 540 })
})
