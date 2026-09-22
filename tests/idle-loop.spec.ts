// 歩行ループの眠りと目覚めの E2E。止まっている間は次のフレームを頼まず(枠の data-village-loop が idle)、
// 方向キー・スティック・タップの最初の 1 回、会話窓を閉じた後の入力、画面の大きさの変化で起きて
// 描き直すことを見る。会話窓を開いている間は本文送りのループも押すまで眠る。
// ループの眠り方は言語に依らないので ja だけで見る。
// 釣りのコマが時間で替わる間(投げる・かかった合図・引き上げ)は眠らずにコマを進め切り、動き終えれば眠ることは
// fishing.spec が時計を止めて見ている。池までの 13 マスをここで繰り返さない
import { expect, type Page } from '@playwright/test'
import { worldSet } from '@content/world'
import { village } from '@content/ja/village'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・押下と到着待ちの間合い・描画待ち・既定で晴れを敷く test は
// 他の村の spec と共用。正本は village.helpers.ts
import { HOLD_MS, SETTLE_MS, openVillage, settleRender, test, walk } from './village.helpers'

// 位置の保存先は lib/preferences と同じ組み立て
const POS_KEY = `village:${worldSet.id}:pos`

// 保存された現在地(ワールドとマス)を読む。保存は到着したマスでだけ走る
const readCell = (page: Page) =>
  page.evaluate(key => {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    const saved = JSON.parse(raw) as { worldId: string; cell: { x: number; y: number } }
    return { worldId: saved.worldId, cell: saved.cell }
  }, POS_KEY)

// 歩行ループが眠るまで待つ。起きてから眠るまで(歩き終えてカメラが追い付くまで)は 1 秒かからない
const expectLoopIdle = (page: Page) =>
  expect(page.locator('[data-village]')).toHaveAttribute('data-village-loop', 'idle', {
    timeout: 3_000,
  })

// アプリが頼んだ rAF の数を数える。ページのどのスクリプトよりも先に差し込み、
// 村の 2 本のループ(歩行・本文送り)が呼ぶ window.requestAnimationFrame を包む
type RafCountWindow = Window & { rafRequests?: number }
const countRafRequests = (page: Page) =>
  page.addInitScript(() => {
    const host: RafCountWindow = window
    host.rafRequests = 0
    const request = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = callback => {
      host.rafRequests = (host.rafRequests ?? 0) + 1
      return request(callback)
    }
  })

const rafRequests = (page: Page) =>
  page.evaluate(() => {
    const host: RafCountWindow = window
    return host.rafRequests ?? 0
  })

// 1 秒のあいだにアプリが頼んだ rAF の数。回っていれば約 60、眠っていれば 0。
// この間は settleRender(自身が rAF を頼む)を呼ばない
const rafRequestsInOneSecond = async (page: Page) => {
  const start = await rafRequests(page)
  await page.waitForTimeout(1_000)
  return (await rafRequests(page)) - start
}

// 眠っていても 1 秒で頼んでよい数。吹き出しの位置合わせ(rAF 2 回)のような一度きりの分の遊び
const IDLE_RAF_ALLOWANCE = 2

// 主人公が枠の中で何マス目に立って見えるか(左上が 0)。シートは縦 1.5 マスで頭が半マス上へはみ出すので、
// 足元(下辺)から数える。マス寸法は枠の幅(10 列)から出す
const playerOnScreen = async (page: Page) => {
  const frame = await page.locator('[data-village]').boundingBox()
  const player = await page.locator('[data-village-player]').boundingBox()
  if (frame === null || player === null) throw new Error('村の枠か主人公が描かれていない')
  const cell = frame.width / 10
  return {
    frame,
    cell,
    x: (player.x - frame.x) / cell,
    y: (player.y + player.height - frame.y) / cell - 1,
  }
}

test('止まっている間は歩行ループが眠り、最初の方向キー 1 回で 1 マス歩く', async ({ page }) => {
  await countRafRequests(page)
  await openVillage(page, '')
  const frame = page.locator('[data-village]')
  await expectLoopIdle(page)
  expect(await rafRequestsInOneSecond(page)).toBeLessThanOrEqual(IDLE_RAF_ALLOWANCE)
  await expect(frame).toHaveAttribute('data-village-loop', 'idle')
  // 起きて眠り直すまでの印の移り変わりを控える。一瞬だけの running も取りこぼさない
  await frame.evaluate(element => {
    element.setAttribute('data-observed-loop', '')
    new MutationObserver(() => {
      const seen = element.getAttribute('data-observed-loop') ?? ''
      const state = element.getAttribute('data-village-loop') ?? ''
      element.setAttribute('data-observed-loop', seen === '' ? state : `${seen},${state}`)
    }).observe(element, { attributes: true, attributeFilter: ['data-village-loop'] })
  })
  // 読み込み直後は保存を捨てて開始地点 (4,4) から始まるので、まだ何も保存されていない
  expect(await readCell(page)).toBeNull()
  // 眠っている所へ押した最初の 1 回が読まれ、1 マス下へ着く(起こし忘れると 1 歩も動かない)。
  // walk は 1 マスにつき押して離すのを 1 回だけ行うので、ここで押すのは最初の 1 回きり
  expect(await walk(page, 'ArrowDown', 1)).toBe(1)
  expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
  // 歩き終えたらまた眠る。途中で一度は起きていた
  await expectLoopIdle(page)
  await expect(frame).toHaveAttribute('data-observed-loop', /^running(,.+)?,idle$/)
})

test('会話窓を開いている間は 2 本のループとも眠り、閉じた後の最初の入力で歩き出す', async ({
  page,
}) => {
  // PC 原寸の枠(640×576)だと自宅の本文が窓に収まり、送る余地が残らないことがある。
  // 高さを詰めて枠ごと縮め、本文を必ずあふれさせる(journey.spec と同じ寸法)
  await page.setViewportSize({ width: 1280, height: 480 })
  await countRafRequests(page)
  await openVillage(page, '')
  const dialog = page.getByRole('dialog')
  const panel = dialog.locator('[data-village-panel]')
  await page.keyboard.press('e')
  await expect(dialog.getByRole('heading', { name: village.stops.home.title })).toBeFocused()
  // 窓が開いている間は歩かないので歩行ループは眠り、本文送りのループも押すまでは眠る
  await expectLoopIdle(page)
  expect(await rafRequestsInOneSecond(page)).toBeLessThanOrEqual(IDLE_RAF_ALLOWANCE)
  // 眠っていた本文送りが下キーで起き、本文が送られる
  await page.keyboard.down('ArrowDown')
  await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await page.keyboard.up('ArrowDown')
  await dialog.getByRole('button', { name: village.close }).click()
  await expect(dialog).toHaveCount(0)
  // 閉じて錠が外れた後も、眠っている所へ押した最初の 1 回で歩く
  await expectLoopIdle(page)
  expect(await walk(page, 'ArrowDown', 1)).toBe(1)
  expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
})

test('眠っている間に画面の大きさが変わると、起きて新しいマス寸法で描き直す', async ({ page }) => {
  await openVillage(page, '')
  // 町ではカメラが動く(自宅前 (14,12) で原点 (10,8))ので、人物と世界の層の両方を描き直したかを見られる
  expect(await walk(page, 'ArrowDown', 3)).toBe(3)
  expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 14, y: 12 } })
  // ワープの後も、新しいタイルが載ってカメラが追い付けば眠る
  await expectLoopIdle(page)
  const before = await playerOnScreen(page)
  // カメラは人物を枠の左から 5 番目・上から 5 番目のマスへ置く
  expect(before.x).toBeCloseTo(4, 1)
  expect(before.y).toBeCloseTo(4, 1)
  // 高さで決まる 50px 以下のマスへ縮める(PC 原寸は 64px)
  await page.setViewportSize({ width: 800, height: 450 })
  await expect.poll(async () => (await playerOnScreen(page)).cell).toBeLessThan(before.cell)
  // 描き直さなければ人物も世界の層も 64px 基準の位置に残り、5.1 マス目や 1.2 マス目を指す
  await expect.poll(async () => (await playerOnScreen(page)).x).toBeCloseTo(4, 1)
  await expect.poll(async () => (await playerOnScreen(page)).y).toBeCloseTo(4, 1)
  await expectLoopIdle(page)
})

// devices[] は defaultBrowserType を含み describe 内で使えないため、寸法と入力種別だけ指定する
test.describe('縦持ちのスマートフォン', () => {
  test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true })

  test('眠っている間にスティックを倒した 1 回と、タップした 1 回でそれぞれ歩く', async ({
    page,
  }) => {
    await openVillage(page, '')
    await expectLoopIdle(page)
    const stick = await page.getByRole('application', { name: village.joystick }).boundingBox()
    if (stick === null) throw new Error('スティックが無い')
    const x = stick.x + stick.width / 2
    const y = stick.y + stick.height / 2
    // 下へ倒して 1 マス分だけ押し、中央へ戻して離す
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 30)
    await page.waitForTimeout(HOLD_MS)
    await page.mouse.move(x, y)
    await page.mouse.up()
    await page.waitForTimeout(SETTLE_MS)
    await settleRender(page)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 5 } })
    await expectLoopIdle(page)
    // 眠っている所で 1 マス上 (4,4) を叩くと、そこへ歩いて戻る。部屋は枠に収まりカメラは動かない
    const { frame, cell, x: column, y: row } = await playerOnScreen(page)
    await page.touchscreen.tap(frame.x + (column + 0.5) * cell, frame.y + (row - 0.5) * cell)
    await expect.poll(() => readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 4 } })
    await expectLoopIdle(page)
  })
})
