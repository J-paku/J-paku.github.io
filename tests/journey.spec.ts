// 村の導線 E2E。部屋の会話 → 扉で町へ → 作品と一覧、地図の高速移動、位置と訪問の保存、
// テーマ、家具の当たり判定を ja/ko 双方で確認する
import { expect, test, type Locator, type Page } from '@playwright/test'
import type { VillageText } from '@content/types/world'
import { worldSet } from '@content/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
import { ui as uiJa } from '@content/ja/ui'
import { ui as uiKo } from '@content/ko/ui'
// 村を開く手順・歩きの間合い・描画待ちは day-night.spec と共用。正本は village.helpers.ts
import { HOLD_MS, SETTLE_MS, focusVillage, openVillage, settleRender } from './village.helpers'

type SettingsLabels = { menu: string; light: string; dark: string }
type Journey = { prefix: string; text: VillageText; settings: SettingsLabels }

const JOURNEYS: Journey[] = [
  {
    prefix: '',
    text: villageJa,
    settings: { menu: uiJa.settingsMenu.label, light: uiJa.theme.light, dark: uiJa.theme.dark },
  },
  {
    prefix: '/ko',
    text: villageKo,
    settings: { menu: uiKo.settingsMenu.label, light: uiKo.theme.light, dark: uiKo.theme.dark },
  },
]

// 位置と訪問の保存先は lib/preferences と同じ組み立て
const POS_KEY = `village:${worldSet.id}:pos`
const VISITED_KEY = `village:${worldSet.id}:visited`
const WORK_SLUG = 'meishi-cross-platform'

// 方向キーを 1 マス分だけ押し、到着まで待ってから次の 1 マスへ進む
const walk = async (page: Page, key: string, cells: number) => {
  for (let i = 0; i < cells; i += 1) {
    await page.keyboard.down(key)
    await page.waitForTimeout(HOLD_MS)
    await page.keyboard.up(key)
    await page.waitForTimeout(SETTLE_MS)
    await settleRender(page)
  }
}

// 会話窓の本文は押している間フレーム単位で送られるので、押した瞬間だけの press では
// 1フレームも挟まらず届かない。押してから離すまでの長さで送る量が決まる
const holdDown = async (page: Page, ms: number) => {
  await page.keyboard.down('ArrowDown')
  await page.waitForTimeout(ms)
  await page.keyboard.up('ArrowDown')
}

// 本文が下端に着いたか。scrollTop は小数を持つので 1px の遊びを見る(use-held-scroll と同じ)
const panelAtBottom = (panel: Locator) =>
  panel.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 1)

// 本文を下端まで送る。焦点が動くのは「押した瞬間に下端だった」時だけなので、
// 送り切る前にボタンへ飛び移ることはない(短くて送る必要が無ければ1度も押さずに抜ける)
const scrollPanelToBottom = async (page: Page, panel: Locator) => {
  for (let i = 0; i < 20 && !(await panelAtBottom(panel)); i += 1) {
    await holdDown(page, 300)
  }
}

// 保存された現在地(ワールドとマス)を読む。村は 2 ワールドなのでマスだけでは位置が決まらない
const readCell = (page: Page) =>
  page.evaluate(key => {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    const saved = JSON.parse(raw) as { worldId: string; cell: { x: number; y: number } }
    return { worldId: saved.worldId, cell: saved.cell }
  }, POS_KEY)

// 訪問済み地点の id 一覧を読む
const readVisited = (page: Page) =>
  page.evaluate(key => {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return []
    return JSON.parse(raw) as string[]
  }, VISITED_KEY)

// 現在の部屋は下端の1マスマットから外へ出る
const leaveRoom = async (page: Page) => {
  await walk(page, 'ArrowDown', 3)
}

for (const { prefix, text, settings } of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix
  const home = text.stops.home
  const meishi = text.stops.meishi
  const lab = text.stops.lab
  const robot = text.stops.robot
  const mailbox = text.stops.mailbox
  const monument = text.stops.monument

  test(`自分の部屋の会話から次の目的地を案内する (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    const speech = page.getByRole('status')
    await expect(page.locator('[data-village-bubble]')).toContainText(
      home.arrive ?? text.arriveAt.replace('{place}', home.place),
      { timeout: 3_000 }
    )
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await dialog.getByRole('button', { name: home.next }).click()
    await expect(dialog).toHaveCount(0)
    await expect(speech).toContainText(text.headTo.replace('{place}', meishi.place), {
      timeout: 3_000,
    })
    expect(await readVisited(page)).toContain('home')
  })

  test(`部屋の扉から町へ出る (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await leaveRoom(page)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 14, y: 12 } })
    // 町では既定の案内が操作説明に変わる
    await expect(page.getByRole('status')).toContainText(text.hint, { timeout: 3_000 })
  })

  test(`話せる相手がいない所でEを押すと考え事の一言が出て人物に追従する (${label})`, async ({
    page,
  }) => {
    await openVillage(page, prefix)
    await leaveRoom(page)
    // 自宅前 (14,12) から1マス離れ、話せる相手がいない通路へ出る
    await walk(page, 'ArrowRight', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 15, y: 12 } })
    await page.keyboard.press('e')
    const bubble = page.locator('[data-village-bubble][data-village-bubble-kind="thought"]')
    await expect(bubble).toContainText(text.noTarget)
    // 一言は2.5秒で消えるタイマー付きなので、消える前に1マス歩いて追従するか確認する
    await walk(page, 'ArrowRight', 1)
    await expect(bubble).toBeVisible()
  })

  test(`町の自宅の扉から部屋へ戻る (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await leaveRoom(page)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 14, y: 12 } })
    // 自宅前(14,12)で上を1回押すと自宅の扉(14,11)へぶつかり、部屋の出口手前(4,6)へ戻る
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 6 } })
  })

  test(`町の名刺工房から作品ページと一覧へ進む (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await leaveRoom(page)
    // 自宅前 (14,12) から左 4・上 6・左 4 で名刺工房 (6,6)
    await walk(page, 'ArrowLeft', 4)
    await walk(page, 'ArrowUp', 6)
    await walk(page, 'ArrowLeft', 4)
    await expect(page.locator('[data-village-bubble]')).toContainText(
      text.arriveAt.replace('{place}', meishi.place),
      { timeout: 3_000 }
    )
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible()
    // 内部リンクなので同じタブで開く
    const link = dialog.getByRole('link')
    await expect(link).toHaveAttribute('href', `${prefix}/works/${WORK_SLUG}/`)
    await expect(link).not.toHaveAttribute('target', '_blank')
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${prefix}/works/${WORK_SLUG}/$`))
    await expect(page.locator('main h1')).toBeVisible()
    await page.locator(`a[href="${prefix}/list/"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`${prefix}/list/$`))
    await expect(page.locator('#works')).toBeVisible()
  })

  test(`一覧の「マップで見る」から村へ戻るとブートが正しく終わる (${label})`, async ({ page }) => {
    // 一覧ページからのクライアント遷移(<Link>)で村へ戻る。挿入された script は
    // ブラウザが実行しないため、Boot の effect 側が代わりに舞台を開ける
    await page.goto(`${prefix}/list/`)
    await page.getByRole('link', { name: text.toVillage }).click()
    await page.waitForSelector('#boot', { state: 'detached', timeout: 3_000 })
    await expect(page.locator('[data-village]')).toBeVisible()
    await page.locator('[data-village]').focus()
    // 位置は到着時にだけ保存されるので、往復1マスで部屋の開始マスを保存させてから読む
    await walk(page, 'ArrowRight', 1)
    await walk(page, 'ArrowLeft', 1)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 4 } })
  })

  test(`町の地図から研究所へ高速移動する (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await leaveRoom(page)
    const map = page.getByRole('dialog')
    // ミニマップのボタンでも同じ地図が開く
    await page.getByRole('button', { name: text.openMap }).click()
    await expect(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(map).toHaveCount(0)
    // ミニマップを押して閉じただけでは歩き出さない(押下が移動指示に化けない)
    const before = await readCell(page)
    await page.waitForTimeout(400)
    expect(await readCell(page)).toEqual(before)
    await page.keyboard.press('m')
    await expect(map.getByRole('heading', { name: text.mapTitle })).toBeVisible()
    await map.getByRole('button', { name: text.fastTravel.replace('{place}', lab.place) }).click()
    await expect(map).toHaveCount(0)
    await expect(page.locator('[data-village-bubble]')).toContainText(
      text.arriveAt.replace('{place}', lab.place),
      { timeout: 2_500 }
    )
  })

  test(`再読み込みで村が最初からやり直しになる (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    // 自宅(4,4)で会話してから右へ2マス歩き、位置と訪問の両方を保存させる
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await walk(page, 'ArrowRight', 2)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 6, y: 4 } })
    expect(await readVisited(page)).toContain('home')
    // 再読み込みは村を最初から始め直すので訪問は空に戻る
    await page.reload()
    await focusVillage(page)
    expect(await readVisited(page)).toEqual([])
    // 位置は到着時にだけ保存されるので、往復1マスで現在地を保存させてから読む
    await walk(page, 'ArrowRight', 1)
    await walk(page, 'ArrowLeft', 1)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 4 } })
  })

  test(`設定メニューのテーマ切り替えが再読み込み後も残る (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    const root = page.locator('html')
    const trigger = page.getByRole('button', { name: settings.menu })
    await trigger.click()
    await page.getByRole('group').getByRole('button', { name: settings.dark }).click()
    await expect(root).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await focusVillage(page)
    await expect(root).toHaveAttribute('data-theme', 'dark')
    await trigger.click()
    await page.getByRole('group').getByRole('button', { name: settings.light }).click()
    await expect(root).toHaveAttribute('data-theme', 'light')
  })

  test(`部屋の机で歩みが止まる (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    // 位置は到着時にだけ保存されるので、往復 1 マスで (4,4) を保存させてから壁に当てる
    await walk(page, 'ArrowRight', 1)
    await walk(page, 'ArrowLeft', 1)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 4 } })
    // (4,4) の上は PC 机。押し続けても進まず、ページも動かない
    await page.keyboard.down('ArrowUp')
    await page.waitForTimeout(700)
    await page.keyboard.up('ArrowUp')
    await page.waitForTimeout(SETTLE_MS)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 4 } })
    await expect(page).toHaveURL(new RegExp(`${prefix}/$`))
  })
  test(`机の左・右・正面から会話できる (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    const check = async () => {
      await expect(page.locator('[data-village-bubble]')).toBeVisible()
      await page.keyboard.press('e')
      await expect(
        page.getByRole('dialog').getByRole('heading', { name: home.title })
      ).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await check()
    await walk(page, 'ArrowLeft', 2)
    await walk(page, 'ArrowUp', 1)
    await check()
    await walk(page, 'ArrowDown', 1)
    await walk(page, 'ArrowRight', 4)
    await walk(page, 'ArrowUp', 1)
    await check()
    await walk(page, 'ArrowRight', 2)
    await expect(page.locator('[data-village-bubble]')).toHaveCount(0)
  })

  test(`次へボタンで名刺工房まで自動で歩き、着いたら会話が開く (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await dialog.getByRole('button', { name: home.next }).click()
    // 部屋の中 3 マス + 扉 + 町 14 マスを 128ms/マスで自動歩行してから会話窓が開く
    await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible({
      timeout: 10_000,
    })
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 6, y: 6 } })
  })

  test(`途中で歩くと自動の会話は開かない (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await dialog.getByRole('button', { name: home.next }).click()
    // 部屋の中(3 マス分の途中)で割り込む
    await page.waitForTimeout(150)
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(150)
    await page.keyboard.up('ArrowRight')
    await page.waitForTimeout(3_000)
    await expect(dialog).toHaveCount(0)
    expect((await readCell(page))?.worldId).toBe('room')
  })

  test(`5 か所すべて話すと案内が変わり一覧のボタンへ焦点が移る (${label})`, async ({ page }) => {
    // 10s 待ちを4回連ねるので既定の30sを超える
    test.setTimeout(60_000)
    await openVillage(page, prefix)
    const dialog = page.getByRole('dialog')
    await page.keyboard.press('e')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await dialog.getByRole('button', { name: home.next }).click()
    await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible({
      timeout: 10_000,
    })
    await dialog.getByRole('button', { name: meishi.next }).click()
    await expect(dialog.getByRole('heading', { name: lab.title })).toBeVisible({
      timeout: 10_000,
    })
    await dialog.getByRole('button', { name: lab.next }).click()
    await expect(dialog.getByRole('heading', { name: robot.title })).toBeVisible({
      timeout: 10_000,
    })
    await dialog.getByRole('button', { name: robot.next }).click()
    await expect(dialog.getByRole('heading', { name: mailbox.title })).toBeVisible({
      timeout: 10_000,
    })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText(
      text.allSeen.replace('{list}', text.toList)
    )
    const exit = page.locator('[data-village-exit]')
    await expect(exit).toBeFocused()
    await expect(exit).toHaveAttribute('data-bounce', '')
  })

  test(`町の経歴碑でロゴ付きの職歴一覧を確認でき、完走判定には数えない (${label})`, async ({
    page,
  }) => {
    // 経歴碑の確認に続けて残り5か所も巡るので、次へ連鎖の待ちが重なり既定の30秒を超える
    test.setTimeout(60_000)
    await openVillage(page, prefix)
    await leaveRoom(page)
    // 自宅前 (14,12) から左 3(x=11)・上 6(y=6)・右 2(x=13)・上 1(y=5) で経歴碑。
    // 経路のマスは content/world.ts の道(path)と草地(grass/grass-alt)のみを通る
    await walk(page, 'ArrowLeft', 3)
    await walk(page, 'ArrowUp', 6)
    await walk(page, 'ArrowRight', 2)
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 13, y: 5 } })
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: monument.title })).toBeVisible()
    const entries = monument.entries
    if (entries === undefined) throw new Error('経歴碑の entries が無い')
    await expect(dialog.getByRole('img')).toHaveCount(entries.length)
    for (const entry of entries) {
      const logo = dialog.getByRole('img', { name: entry.company })
      await expect(logo).toBeVisible()
      await expect
        .poll(() => logo.evaluate(el => (el as HTMLImageElement).naturalWidth), {
          timeout: 5_000,
        })
        .toBeGreaterThan(0)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    // コース外の地点なので、話しても5か所の完走案内は発火しない
    await expect(page.getByRole('status')).not.toContainText(
      text.allSeen.replace('{list}', text.toList)
    )
    // 経歴碑から自宅前までの往路をそのまま逆にたどり、扉を抜けて自宅の会話起点(4,4)へ戻る
    await walk(page, 'ArrowDown', 1)
    await walk(page, 'ArrowLeft', 2)
    await walk(page, 'ArrowDown', 6)
    await walk(page, 'ArrowRight', 3)
    await walk(page, 'ArrowUp', 1)
    await walk(page, 'ArrowUp', 2)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 4 } })
    // ここから先は「5 か所すべて話すと案内が変わり一覧のボタンへ焦点が移る」と同じ次へ連鎖で
    // 残り4か所(コース地点)を巡り、経歴碑を挟んでも完走判定が数え漏れなく動くことを確認する
    await page.keyboard.press('e')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await dialog.getByRole('button', { name: home.next }).click()
    await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible({
      timeout: 10_000,
    })
    await dialog.getByRole('button', { name: meishi.next }).click()
    await expect(dialog.getByRole('heading', { name: lab.title })).toBeVisible({
      timeout: 10_000,
    })
    await dialog.getByRole('button', { name: lab.next }).click()
    await expect(dialog.getByRole('heading', { name: robot.title })).toBeVisible({
      timeout: 10_000,
    })
    await dialog.getByRole('button', { name: robot.next }).click()
    await expect(dialog.getByRole('heading', { name: mailbox.title })).toBeVisible({
      timeout: 10_000,
    })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText(
      text.allSeen.replace('{list}', text.toList)
    )
  })

  test.describe(`A/B ボタン (${label})`, () => {
    test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true })

    test(`タッチ端末では町の操作案内がスティックと A の説明になる`, async ({ page }) => {
      await openVillage(page, prefix)
      await leaveRoom(page)
      await expect(page.getByRole('status')).toContainText(text.hintTouch, { timeout: 3_000 })
      await expect(page.locator('[data-village]')).toHaveAttribute('aria-label', text.hintTouch)
      // 案内文は窓の中で折り返し、右へはみ出さない(keep-all で <wbr> が無いと一行のまま外へ出る)
      const overflow = await page.getByRole('status').evaluate(box => {
        const span = box.querySelector('span')
        if (span === null) throw new Error('案内文が無い')
        return span.getBoundingClientRect().right - box.getBoundingClientRect().right
      })
      expect(overflow).toBeLessThanOrEqual(0)
    })

    test(`A で会話を開き、B で閉じ、次へで名刺工房まで進む`, async ({ page }) => {
      await openVillage(page, prefix)
      const dialog = page.getByRole('dialog')
      await page.getByRole('button', { name: text.buttonA }).tap()
      await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
      await page.getByRole('button', { name: text.buttonB }).tap()
      await expect(dialog).toHaveCount(0)
      await page.getByRole('button', { name: text.buttonA }).tap()
      await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
      // モーダルが開いている間の A は次へボタンと同じ
      await page.getByRole('button', { name: text.buttonA }).tap()
      await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible({
        timeout: 10_000,
      })
      await page.getByRole('button', { name: text.buttonB }).tap()
      await expect(dialog).toHaveCount(0)
    })

    test(`本文を最後まで送ると次へボタンへ焦点が移り、そのまま A で押せる`, async ({ page }) => {
      await openVillage(page, prefix)
      const dialog = page.getByRole('dialog')
      await page.getByRole('button', { name: text.buttonA }).tap()
      await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
      const panel = dialog.locator('[data-village-panel]')
      await scrollPanelToBottom(page, panel)
      expect(await panelAtBottom(panel)).toBe(true)
      // 下端からもう一度下を押すと、送る先が無いので焦点が窓の最初のボタンへ移る
      await holdDown(page, HOLD_MS)
      await expect(dialog.getByRole('button', { name: home.next })).toBeFocused()
      // 焦点の当たったボタンを A で押す。次の地点まで自動で歩き、名刺工房の会話が開く
      await page.getByRole('button', { name: text.buttonA }).tap()
      await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible({
        timeout: 10_000,
      })
    })

    test(`本文にリンクがある地点では、リンク・次へボタンの順に焦点が移る`, async ({ page }) => {
      // 名刺工房までの自動歩行(10s 待ち)に本文送りが続くので、既定の 30s では足りない
      test.setTimeout(60_000)
      const link = meishi.link
      if (link === undefined) throw new Error('名刺工房の link が無い')
      await openVillage(page, prefix)
      const dialog = page.getByRole('dialog')
      await page.getByRole('button', { name: text.buttonA }).tap()
      await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
      // モーダルが開いている間の A は次へボタンと同じ。自動で歩いた先で名刺工房の会話が開く
      await page.getByRole('button', { name: text.buttonA }).tap()
      await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible({
        timeout: 10_000,
      })
      const panel = dialog.locator('[data-village-panel]')
      await scrollPanelToBottom(page, panel)
      expect(await panelAtBottom(panel)).toBe(true)
      // 焦点は DOM 順に渡る。ここは本文の中のリンクが操作ボタンより先にある地点なので、まずリンクへ
      await holdDown(page, HOLD_MS)
      await expect(dialog.getByRole('link', { name: link.label })).toBeFocused()
      // もう一度下を押すと次へボタンへ。リンクは押すとページが移ってしまうのでここでは押さない
      await holdDown(page, HOLD_MS)
      await expect(dialog.getByRole('button', { name: meishi.next })).toBeFocused()
    })
  })

  test(`押しっぱなしで指を動かすと歩く先が変わる (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    const frame = await page.locator('[data-village]').boundingBox()
    if (frame === null) throw new Error('[data-village] が描かれていない')
    const cell = frame.width / 10
    // 部屋 10×8 は枠(10×9)に収まる。カメラ原点は人物(4,4)の画面位置から逆算する
    const player = await page.locator('[data-village-player]').boundingBox()
    if (player === null) throw new Error('[data-village-player] が描かれていない')
    const originX = 4 - (player.x - frame.x) / cell
    const originY = 4 - (player.y - frame.y) / cell
    const at = (x: number, y: number) => ({
      x: frame.x + (x - originX + 0.5) * cell,
      y: frame.y + (y - originY + 0.5) * cell,
    })
    // 押したまま動かす → 動かした先(最後にポインタがあったマス)へ着く
    const a = at(8, 4)
    await page.mouse.move(a.x, a.y)
    await page.mouse.down()
    await page.waitForTimeout(700)
    const b = at(8, 6)
    await page.mouse.move(b.x, b.y, { steps: 3 })
    await page.waitForTimeout(1_500)
    await page.mouse.up()
    await page.waitForTimeout(400)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 8, y: 6 } })
    // 短いタップは今まで通り歩く
    const c = at(4, 4)
    await page.mouse.click(c.x, c.y)
    await page.waitForTimeout(2_500)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 4 } })
  })
}
