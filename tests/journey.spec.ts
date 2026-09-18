// 村の導線 E2E。部屋の会話 → 扉で町へ → 作品と一覧、地図の高速移動、位置と訪問の保存、
// テーマ、家具の当たり判定を ja/ko 双方で確認する
import { expect, test, type Page } from '@playwright/test'
import type { VillageText } from '@content/types/world'
import { worldSet } from '@content/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
import { ui as uiJa } from '@content/ja/ui'
import { ui as uiKo } from '@content/ko/ui'

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
// 短押しは旋回だけ(TURN_MS 64ms)。旋回を越えて 1 マス分の移動を始めるまで押し、
// 始まった移動は離しても最後まで進む(CELL_MS 256ms)ので到着を待ってから次の 1 マスへ
const HOLD_MS = 150
const SETTLE_MS = 320
const WORK_SLUG = 'meishi-cross-platform'

// ブート演出が消えるまで待ち、キー操作を受け取る村の枠へフォーカスする
const focusVillage = async (page: Page) => {
  await page.waitForSelector('#boot', { state: 'detached', timeout: 5_000 })
  await page.getByRole('application').focus()
}

const openVillage = async (page: Page, prefix: string) => {
  await page.goto(`${prefix}/`)
  await focusVillage(page)
}

// 方向キーを 1 マス分だけ押し、到着まで待ってから次の 1 マスへ進む
const walk = async (page: Page, key: string, cells: number) => {
  for (let i = 0; i < cells; i += 1) {
    await page.keyboard.down(key)
    await page.waitForTimeout(HOLD_MS)
    await page.keyboard.up(key)
    await page.waitForTimeout(SETTLE_MS)
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

// 現在の部屋は下端の2マスマットから外へ出る
const leaveRoom = async (page: Page) => {
  await walk(page, 'ArrowDown', 3)
}

for (const { prefix, text, settings } of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix
  const home = text.stops.home
  const meishi = text.stops.meishi
  const lab = text.stops.lab

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

  test(`家の広い入口は右側からも入れる (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await leaveRoom(page)
    await walk(page, 'ArrowRight', 1)
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 5, y: 6 } })
    await walk(page, 'ArrowDown', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 14, y: 12 } })
  })
}
