// 村の枠に重ねる窓(会話窓・拡大地図・卓上時計の窓)の焦点と、吹き出しを枠の左右へ押し戻す E2E。
// 窓は role='dialog' の div と手製の Tab の輪(Village/hooks/use-dialog-focus.ts)で作るので、ブラウザは輪を保証しない。
// Tab で末尾から先頭へ、Shift+Tab で先頭から末尾へ回ること・閉じると開く前の村の枠へ焦点が戻ることを 3 つの窓で見る。
// 吹き出しは部屋の左右の壁際で出し、押し戻し(Village/components/TalkBubble/utils/shift-bubble.ts)で枠の中に収まるかを縦持ちの画面で見る。
// 焦点の動きも吹き出しの位置も言語では変わらないので ja だけ見る
import { expect, type Locator, type Page } from '@playwright/test'
import { village } from '@content/ja/village'
import {
  CLOCK_FOCUSABLE_SELECTOR,
  MAP_FOCUSABLE_SELECTOR,
  STOP_FOCUSABLE_SELECTOR,
} from '@/components/VillagePage/components/Village/utils/focusables'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・既定で晴れを敷く test は他の村の spec と共用。正本は village.helpers.ts
import { openVillage, test, walk, type WalkKey } from './village.helpers'

// キーを受け取る村の枠。どの窓も閉じるとここへ焦点を戻す
const FRAME = '[data-village]'
// 話せる相手がいない所で話しかけた時に頭上へ出る考え事の吹き出し
const THOUGHT = '[data-village-bubble][data-village-bubble-kind="thought"]'
// 吹き出しは出た直後(rAF 2 回の後)と、カメラが落ち着く 350ms 後(TalkBubble の SETTLE_DELAY)に測り直す。
// 測り直しを終えた後の位置を見るため、それより後で測る。一言は 2.5 秒で消えるので、それより前に測る
const BUBBLE_SETTLED_MS = 800

// 窓の中で焦点を移せる要素(DOM 順)のうち、今の焦点が何番目か。並びの外(見出しなど)なら -1
const focusIndex = (dialog: Locator, selector: string) =>
  dialog.evaluate(
    (root, sel) =>
      Array.from(root.querySelectorAll(sel)).findIndex(
        element => element === document.activeElement
      ),
    selector
  )

// 今の焦点から Tab で 1 つずつ末尾まで進め、末尾の次は先頭へ、先頭の前は末尾へ回るのを見る。
// 両端の間は窓の DOM 順のまま 1 つずつ進む(輪が手を出すのは両端だけ)。輪が外れていると、
// 末尾の Tab・先頭の Shift+Tab で焦点が窓の外へ出て落ちる
const cycleWithTab = async (page: Page, dialog: Locator, selector: string) => {
  const items = dialog.locator(selector)
  const count = await items.count()
  // 1 つだけだと先頭と末尾が同じで、回ったのか留まったのかを見分けられない
  expect(count, '窓の中に焦点を移せる要素が 2 つ以上ある').toBeGreaterThanOrEqual(2)
  let index = await focusIndex(dialog, selector)
  while (index < count - 1) {
    const next = index + 1
    await page.keyboard.press('Tab')
    await expect
      .poll(() => focusIndex(dialog, selector), { message: `Tab で ${next} 番目へ進む` })
      .toBe(next)
    index = next
  }
  await page.keyboard.press('Tab')
  await expect(items.first(), '末尾で Tab を押すと先頭へ回る').toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(items.last(), '先頭で Shift+Tab を押すと末尾へ回る').toBeFocused()
}

// 窓を開く前の焦点が村の枠にあるか。閉じた後に枠へ戻ったことが「元からそこにあった」のではなく
// 「戻された」と言えるよう、開く前にも押さえる
const expectFrameFocused = (page: Page, message: string) =>
  expect(page.locator(FRAME), message).toBeFocused()

test('会話窓は Tab の輪を両端で回し、見出しの Shift+Tab は末尾へ、閉じると村の枠へ焦点を戻す (/)', async ({
  page,
}) => {
  await openVillage(page, '')
  // 出発の机の前で、話しかけられる吹き出しが出るのを待つ
  await expect(page.locator('[data-village-bubble]')).toBeVisible({ timeout: 3_000 })
  await expectFrameFocused(page, '開く前の焦点は村の枠')
  await page.keyboard.press('e')
  const dialog = page.getByRole('dialog')
  const title = dialog.getByRole('heading', { name: village.stops.home.title })
  await expect(title, '開いた直後の焦点は見出し').toBeFocused()

  // 見出しは並びの外(-1)。そこから Tab で並びの先頭へ入り、末尾まで進んで回る
  await cycleWithTab(page, dialog, STOP_FOCUSABLE_SELECTOR)

  // 見出しは並びの外だが先頭と同じに扱い、Shift+Tab で末尾へ回す
  await title.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(
    dialog.locator(STOP_FOCUSABLE_SELECTOR).last(),
    '見出しで Shift+Tab を押すと末尾へ回る'
  ).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expectFrameFocused(page, '閉じると村の枠へ焦点が戻る')
})

test('拡大地図は Tab の輪を両端で回し、閉じると村の枠へ焦点を戻す (/)', async ({ page }) => {
  await openVillage(page, '')
  // 地図は町でだけ開く。部屋の下端のマットから町の自宅前へ出る(journey.spec の leaveRoom と同じ道)
  await walk(page, 'ArrowDown', 3)
  await expect(page.locator('[data-world]')).toHaveAttribute('data-world', 'town')
  await expectFrameFocused(page, '開く前の焦点は村の枠')
  await page.keyboard.press('m')
  const map = page.getByRole('dialog')
  await expect(map.getByRole('heading', { name: village.mapTitle })).toBeVisible()
  // 開いた直後の焦点は番号 1 の地点で、並びの先頭(閉じるボタン)ではない。そこから末尾まで進めて回す。
  // 焦点は描いた後の effect が置くので、置かれるまで待つ
  await expect
    .poll(() => focusIndex(map, MAP_FOCUSABLE_SELECTOR), {
      message: '開いた直後の焦点は窓の中の、先頭より後ろ',
    })
    .toBeGreaterThan(0)

  await cycleWithTab(page, map, MAP_FOCUSABLE_SELECTOR)

  await page.keyboard.press('Escape')
  await expect(map).toHaveCount(0)
  await expectFrameFocused(page, '閉じると村の枠へ焦点が戻る')
})

test('卓上時計の窓は 1 段目も 2 段目も Tab の輪を両端で回し、閉じると村の枠へ焦点を戻す (/)', async ({
  page,
}) => {
  await openVillage(page, '')
  // 部屋の開始マス (4,4) から時計の前 (7,3) へ(clock.spec の walkToClock と同じ道)
  expect(await walk(page, 'ArrowRight', 3), '時計と同じ列まで歩けた').toBe(3)
  expect(await walk(page, 'ArrowUp', 1), '時計の前まで歩けた').toBe(1)
  await expect(page.locator('[data-village-bubble]')).toContainText(village.clock.arrive, {
    timeout: 3_000,
  })
  await expectFrameFocused(page, '開く前の焦点は村の枠')
  await page.keyboard.press('e')
  const clockWindow = page.locator('[data-village-clock]')
  await expect(clockWindow).toHaveAttribute('data-step', 'choose')
  // 1 段目は開いた直後の焦点が先頭のボタン
  await expect(
    clockWindow.locator(CLOCK_FOCUSABLE_SELECTOR).first(),
    '開いた直後は先頭'
  ).toBeFocused()
  await cycleWithTab(page, clockWindow, CLOCK_FOCUSABLE_SELECTOR)

  // 2 段目はボタンの並びが入れ替わり、焦点は途中の「決定」から始まる。並びが替わっても輪が回るか
  await clockWindow.getByRole('button', { name: village.clock.custom }).click()
  await expect(clockWindow).toHaveAttribute('data-step', 'pick')
  await expect(clockWindow.getByRole('button', { name: village.clock.decide })).toBeFocused()
  await cycleWithTab(page, clockWindow, CLOCK_FOCUSABLE_SELECTOR)

  await page.keyboard.press('Escape')
  await expect(clockWindow).toHaveCount(0)
  await expectFrameFocused(page, '閉じると村の枠へ焦点が戻る')
})

// 部屋は 10 列で枠の幅と同じなので、カメラは横に動かず、壁際のマスは枠の左右の端に描かれる。
// 開始マス (4,4) の行は家具が無く、左へ 4 マスで左端 (0,4)、右へ 5 マスで右端 (9,4) に着く
const EDGES: { side: string; key: WalkKey; cells: number }[] = [
  { side: '左', key: 'ArrowLeft', cells: 4 },
  { side: '右', key: 'ArrowRight', cells: 5 },
]

// 吹き出し・枠・主人公の横の位置を同じ瞬間に測る
const bubbleSpan = (page: Page) =>
  page.evaluate(selector => {
    const bubble = document.querySelector(selector)
    const frame = bubble === null ? null : bubble.closest('[data-village]')
    const player = document.querySelector('[data-village-player]')
    if (bubble === null || frame === null || player === null) {
      throw new Error('吹き出し・枠・主人公のどれかが描かれていない')
    }
    const b = bubble.getBoundingClientRect()
    const f = frame.getBoundingClientRect()
    const p = player.getBoundingClientRect()
    return {
      frameLeft: f.left,
      frameRight: f.right,
      bubbleLeft: b.left,
      bubbleRight: b.right,
      bubbleWidth: b.width,
      playerCenter: p.left + p.width / 2,
    }
  }, THOUGHT)

// 縦持ちの狭い枠ほど、壁際で出した吹き出しが枠の外へはみ出しやすい。寸法と入力種別は iPhone 13 に揃える
test.describe('吹き出しを枠の左右へ押し戻す (/)', () => {
  test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true })

  for (const { side, key, cells } of EDGES) {
    test(`部屋の${side}の壁際で出した考え事の吹き出しが枠の中に収まる`, async ({ page }) => {
      await openVillage(page, '')
      expect(await walk(page, key, cells), `${side}の壁際まで歩けた`).toBe(cells)
      await page.keyboard.press('e')
      await expect(page.locator(THOUGHT)).toContainText(village.noTarget)
      await page.waitForTimeout(BUBBLE_SETTLED_MS)
      const span = await bubbleSpan(page)

      // 押し戻さなければ、吹き出しは主人公の頭の真上を中心に描かれて枠の外へはみ出す位置にいる。
      // ここが成り立たないと、押し戻しを外しても下の検査が通ってしまう
      const natural = {
        left: span.playerCenter - span.bubbleWidth / 2,
        right: span.playerCenter + span.bubbleWidth / 2,
      }
      const wouldOverflow =
        side === '左' ? natural.left < span.frameLeft : natural.right > span.frameRight
      expect(wouldOverflow, '押し戻さなければ枠の外へはみ出す位置で出している').toBe(true)

      expect(span.bubbleLeft, '吹き出しの左端が枠の中').toBeGreaterThanOrEqual(span.frameLeft)
      expect(span.bubbleRight, '吹き出しの右端が枠の中').toBeLessThanOrEqual(span.frameRight)
    })
  }
})
