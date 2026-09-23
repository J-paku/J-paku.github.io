// 村の導線 E2E。部屋の会話 → 扉で町へ → 作品と一覧、地図の高速移動、位置と訪問の保存、
// テーマ、家具の当たり判定を ja/ko 双方で確認する
import { expect, type Locator, type Page } from '@playwright/test'
import type { VillageText } from '@content/types/world'
import { worldSet } from '@content/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
import { ui as uiJa } from '@content/ja/ui'
import { ui as uiKo } from '@content/ko/ui'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・押下と到着待ちの間合い・既定で晴れを敷く test は
// 他の村の spec と共用。正本は village.helpers.ts
import { HOLD_MS, SETTLE_MS, focusVillage, openVillage, test, walk } from './village.helpers'

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

// 押し直さずに本文を送り切り、最初のリンク・ボタンへ焦点が渡るまで待つ
const scrollPanelToBottom = async (page: Page, panel: Locator) => {
  await page.keyboard.down('ArrowDown')
  await expect(page.getByRole('dialog').locator('a[href], button').first()).toBeFocused({
    timeout: 10_000,
  })
  await page.waitForTimeout(300)
  await expect(page.getByRole('dialog').locator('a[href], button').first()).toBeFocused()
  await page.keyboard.up('ArrowDown')
  expect(await panelAtBottom(panel)).toBe(true)
}

// 保存された現在地(ワールドとマス)を読む。村は 2 ワールドなのでマスだけでは位置が決まらない
const readCell = (page: Page) =>
  page.evaluate(key => {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    const saved = JSON.parse(raw) as { worldId: string; cell: { x: number; y: number } }
    return { worldId: saved.worldId, cell: saved.cell }
  }, POS_KEY)

// 要素が村の枠(overflow: hidden)の中へ収まっているか。外周のマスに立つと主人公の頭と
// 吹き出しが枠の上へ出て切れるため、切れていないことをこの実測で確かめる
const framedInside = async (page: Page, selector: string) => {
  const frame = await page.locator('[data-village]').boundingBox()
  const target = await page.locator(selector).boundingBox()
  if (frame === null || target === null) return false
  return (
    target.y >= frame.y &&
    target.y + target.height <= frame.y + frame.height &&
    target.x >= frame.x &&
    target.x + target.width <= frame.x + frame.width
  )
}

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
    // 位置は到着時にだけ保存されるので、往復 1 マスで (4,4) を保存させてから壁に当てる。
    // walk の戻り値(到着したマス数)はここで確かめる。他のテストは戻り値を見ないので、
    // 到着の判定が壊れて常に 0 や常に cells を返すようになっても、ここ以外では気付けない
    expect(await walk(page, 'ArrowRight', 1), '床へは 1 マス進める').toBe(1)
    expect(await walk(page, 'ArrowLeft', 1), '戻りも 1 マス').toBe(1)
    expect(await readCell(page)).toEqual({ worldId: 'room', cell: { x: 4, y: 4 } })
    // (4,4) の上は PC 机。1 回押しても向きが変わるだけで、到着は 0 マス
    expect(await walk(page, 'ArrowUp', 1), '机へは踏み込めない').toBe(0)
    // 押し続けても進まず、ページも動かない
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
    // 経歴碑の確認に続けて残り4か所も次へ連鎖で巡るので、連鎖の待ち(1 回 10s まで)が重なり
    // 既定の30秒を超えうる
    test.setTimeout(60_000)
    await openVillage(page, prefix)
    const dialog = page.getByRole('dialog')
    // 先に自宅(4,4)で話しておき、コースの自宅と名刺工房の間に経歴碑を挟む
    await page.keyboard.press('e')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await leaveRoom(page)
    // 町の中は地図で高速移動する(町を歩いて通れることは他のテストが確かめる)。
    // 経歴碑は北の道の左右の木の手前 (16,2) に立ち、話しかけるマスはその 2 つ下 (16,4)
    await page.keyboard.press('m')
    await dialog
      .getByRole('button', { name: text.fastTravel.replace('{place}', monument.place) })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => readCell(page)).toEqual({ worldId: 'town', cell: { x: 16, y: 4 } })
    // 地図からの移動では会話窓が開かない。着いた吹き出しが出てから話しかける
    await expect(page.locator('[data-village-bubble]')).toContainText(
      monument.arrive ?? text.arriveAt.replace('{place}', monument.place)
    )
    await page.keyboard.press('e')
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
    // 名刺工房 (6,6) へも地図で移る。ここから先は「5 か所すべて話すと案内が変わり一覧のボタンへ
    // 焦点が移る」と同じ次へ連鎖で残り4か所(コース地点)を巡り、経歴碑を挟んでも完走判定が
    // 数え漏れなく動くことを確認する
    await page.keyboard.press('m')
    await dialog
      .getByRole('button', { name: text.fastTravel.replace('{place}', meishi.place) })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => readCell(page)).toEqual({ worldId: 'town', cell: { x: 6, y: 6 } })
    await expect(page.locator('[data-village-bubble]')).toContainText(
      text.arriveAt.replace('{place}', meishi.place)
    )
    await page.keyboard.press('e')
    await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible()
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

  test(`北の道へ進むと次の旅の会話が開き、閉じて町へ戻れる (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await leaveRoom(page)
    await page.keyboard.press('m')
    await page
      .getByRole('button', { name: text.fastTravel.replace('{place}', monument.place) })
      .click()
    await expect.poll(() => readCell(page)).toEqual({ worldId: 'town', cell: { x: 16, y: 4 } })
    // 経歴碑の前から道へ戻り、外周を抜ける突き当たり (14,0) まで上がる
    await walk(page, 'ArrowLeft', 2)
    await walk(page, 'ArrowUp', 4)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 14, y: 0 } })
    const dialog = page.getByRole('dialog')
    const journey = text.stops.journey
    await expect(dialog.getByRole('heading', { name: journey.title })).toBeVisible()
    await expect(dialog).toContainText(journey.claim)
    await expect(dialog.getByRole('link', { name: journey.link?.label })).toHaveAttribute(
      'href',
      'mailto:pjhrecr@gmail.com'
    )
    await page.keyboard.press('Escape')
    // 突き当たりの中で横へ動いても開き直さない
    await walk(page, 'ArrowRight', 1)
    await expect(dialog).toHaveCount(0)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 15, y: 0 } })
    // 外周のマスは上に置き場が無いので、吹き出しは足元から下へ出て枠に収まる
    await expect(page.locator('[data-village-bubble]')).toBeVisible()
    expect(await framedInside(page, '[data-village-bubble]')).toBe(true)
    // 範囲を出て入り直すと開く
    await walk(page, 'ArrowDown', 1)
    await expect(dialog).toHaveCount(0)
    await walk(page, 'ArrowUp', 1)
    await expect(dialog.getByRole('heading', { name: journey.title })).toBeVisible()
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 15, y: 0 } })
    await page.keyboard.press('Escape')
    await walk(page, 'ArrowDown', 2)
    await expect(dialog).toHaveCount(0)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 15, y: 2 } })
    await expect(page.getByRole('status')).not.toContainText(
      text.allSeen.replace('{list}', text.toList)
    )
  })

  test(`Z で話しかけ、会話中の Z で次の地点へ進み、X で閉じる (${label})`, async ({ page }) => {
    await openVillage(page, prefix)
    await expect(page.locator('[data-village-bubble]')).toBeVisible()
    // Z / X は A / B ボタンと同じ。キー配置に依らず event.code で読むので code 名で押す
    await page.keyboard.press('KeyZ')
    const dialog = page.getByRole('dialog')
    const title = dialog.getByRole('heading', { name: home.title })
    await expect(title).toBeVisible()
    // 焦点が見出し(本文)にある間の Z は次へボタンと同じ。自動で歩いた先で名刺工房の会話が開く
    await expect(title).toBeFocused()
    await page.keyboard.press('KeyZ')
    await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible({
      timeout: 10_000,
    })
    await page.keyboard.press('KeyX')
    await expect(dialog).toHaveCount(0)
  })

  test(`上キーを押し続けると閉じるから見出しまで戻り、本文も巻き戻る (${label})`, async ({
    page,
  }) => {
    // PC 原寸の枠(640×576)だと自宅の本文が窓に収まり、巻き戻す余地が残らないことがある。
    // 高さを詰めて枠ごと縮め、本文を必ずあふれさせる
    await page.setViewportSize({ width: 1280, height: 480 })
    await openVillage(page, prefix)
    await page.keyboard.press('e')
    const dialog = page.getByRole('dialog')
    const panel = dialog.locator('[data-village-panel]')
    const title = dialog.getByRole('heading', { name: home.title })
    const next = dialog.getByRole('button', { name: home.next })
    const close = dialog.getByRole('button', { name: text.close })
    await expect(title).toBeFocused()
    await scrollPanelToBottom(page, panel)
    await expect(next).toBeFocused()
    // 窓の中の焦点の移り先と時刻を控える(見出しは 'heading'、ボタンは文言)。
    // 見出しに着いた後で、戻りが毎フレームではなく間隔を置いて進んだかを読む
    type FocusLog = [string, number][]
    type FocusLogWindow = Window & { focusLog?: FocusLog }
    await dialog.evaluate(root => {
      const log: FocusLog = []
      const host: FocusLogWindow = window
      host.focusLog = log
      root.addEventListener('focusin', event => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return
        const name =
          target instanceof HTMLHeadingElement ? 'heading' : (target.textContent ?? '').trim()
        log.push([name, performance.now()])
      })
    })
    // 進む向きは押した瞬間の 1 つだけ。右で閉じるへ
    await page.keyboard.down('ArrowRight')
    await expect(close).toBeFocused()
    await page.keyboard.up('ArrowRight')
    const before = await panel.evaluate(el => el.scrollTop)
    expect(before).toBeGreaterThan(0)
    // 上を押したまま離さない。閉じる → 次へ → 見出しと間隔を置いて戻り、見出しに着いた後は
    // 押し直さなくても本文が上へ巻き戻る
    await page.keyboard.down('ArrowUp')
    await expect(title).toBeFocused()
    // 1 つずつ戻り、次へから見出しまで FOCUS_BACK_REPEAT_MS(300ms)待つ。250ms はフレームの揺れを
    // 差し引いた下限で、毎フレーム遡る壊れ方はここで落ちる
    const focusLog = await page.evaluate(() => {
      const host: FocusLogWindow = window
      return host.focusLog ?? []
    })
    expect(focusLog.map(([name]) => name)).toEqual([text.close, home.next, 'heading'])
    expect(focusLog[2][1] - focusLog[1][1]).toBeGreaterThanOrEqual(250)
    await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeLessThan(before)
    await page.keyboard.up('ArrowUp')
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
      await expect(dialog.getByRole('link', { name: link.label })).toBeFocused()
      // もう一度下を押すと次へボタンへ。リンクは押すとページが移ってしまうのでここでは押さない
      await holdDown(page, HOLD_MS)
      await expect(dialog.getByRole('button', { name: meishi.next })).toBeFocused()
    })

    test(`スティックの左右で本文を送り、ボタンの焦点を往復する`, async ({ page }) => {
      await openVillage(page, prefix)
      await page.getByRole('button', { name: text.buttonA }).tap()
      const dialog = page.getByRole('dialog')
      const panel = dialog.locator('[data-village-panel]')
      const title = dialog.getByRole('heading', { name: home.title })
      await expect(title).toBeFocused()
      const stick = await page.getByRole('application', { name: text.joystick }).boundingBox()
      if (stick === null) throw new Error('スティックが無い')
      const x = stick.x + stick.width / 2
      const y = stick.y + stick.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 30, y)
      await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
      await page.mouse.move(x - 30, y)
      await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBe(0)
      await page.mouse.move(x + 30, y)
      const next = dialog.getByRole('button', { name: home.next })
      const close = dialog.getByRole('button', { name: text.close })
      await expect(next).toBeFocused({ timeout: 10_000 })
      await page.waitForTimeout(300)
      await expect(next).toBeFocused()
      await page.mouse.move(x, y)
      await page.waitForTimeout(50)
      await page.mouse.move(x + 30, y)
      await expect(close).toBeFocused()
      // 戻る向きは押し続けると 300ms ごとにもう 1 つ遡る。押した瞬間の 1 つを 2 フレームで
      // 処理させてから手を離し、確かめる側の待ち時間で焦点が見出しまで流れないようにする
      const waitTwoFrames = () =>
        page.evaluate(
          () =>
            new Promise<void>(resolve => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            })
        )
      await page.mouse.move(x - 30, y)
      await waitTwoFrames()
      await page.mouse.move(x, y)
      await page.mouse.up()
      await expect(next).toBeFocused()
      await page.keyboard.down('ArrowRight')
      await expect(close).toBeFocused()
      await page.keyboard.up('ArrowRight')
      await page.keyboard.down('ArrowLeft')
      await waitTwoFrames()
      await page.keyboard.up('ArrowLeft')
      await expect(next).toBeFocused()
      await page.waitForTimeout(50)
      await page.keyboard.down('ArrowLeft')
      await expect(title).toBeFocused()
      await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBe(0)
      await page.keyboard.up('ArrowLeft')
    })

    test(`スティックの上を押し続けると閉じるから見出しまで戻り、本文も巻き戻る`, async ({
      page,
    }) => {
      await openVillage(page, prefix)
      await page.getByRole('button', { name: text.buttonA }).tap()
      const dialog = page.getByRole('dialog')
      const panel = dialog.locator('[data-village-panel]')
      const title = dialog.getByRole('heading', { name: home.title })
      const next = dialog.getByRole('button', { name: home.next })
      const close = dialog.getByRole('button', { name: text.close })
      await expect(title).toBeFocused()
      const stick = await page.getByRole('application', { name: text.joystick }).boundingBox()
      if (stick === null) throw new Error('スティックが無い')
      const x = stick.x + stick.width / 2
      const y = stick.y + stick.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      // 右を押し続けて本文を下端まで送り、次へボタンへ焦点を渡す
      await page.mouse.move(x + 30, y)
      await expect(next).toBeFocused({ timeout: 10_000 })
      // 進む向きは押した瞬間の 1 つだけなので、中央へ戻してから右を押し直して閉じるへ
      await page.mouse.move(x, y)
      await page.waitForTimeout(50)
      await page.mouse.move(x + 30, y)
      await expect(close).toBeFocused()
      await page.mouse.move(x, y)
      await page.waitForTimeout(50)
      const before = await panel.evaluate(el => el.scrollTop)
      expect(before).toBeGreaterThan(0)
      // 上へ倒したまま離さない。閉じる → 次へ → 見出しと間隔を置いて戻り、見出しに着いた後は
      // 倒し直さなくても本文が上へ巻き戻る
      await page.mouse.move(x, y - 30)
      await expect(title).toBeFocused()
      await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeLessThan(before)
      await page.mouse.up()
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

// 街灯は絵が縦 2 マス(上が灯・下が柱の根元)ある一方、通行不可なのは根元の 1 マスだけなので、
// 灯のマスは歩いて通り抜けられる。その裏を通る間だけ、主人公の上へ半透明の街灯 1 組(2 マス分)が
// 重なる。重なりは立っているマスだけで決まり言語では変わらないので ja だけ見る
test('灯の裏を通り抜ける間だけ街灯が半透明で重なり、柱の根元は通れない (/)', async ({ page }) => {
  await openVillage(page, '')
  await leaveRoom(page)
  expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 14, y: 12 } })
  // 自宅前 (14,12) から左 4・上 4・左 1 で西の街灯の灯のマス (9,8)。
  // 縦道 x10-11 は y8 まで続くので、北へ 4 マス上がれる。
  // 先に「本当にそのマスに立った」を押さえる。位置がずれたまま 0 枚を数えると、
  // 重なりが壊れたのか立ち位置を外したのか見分けが付かない
  expect(await walk(page, 'ArrowLeft', 4), '横道を西へ 4 マス').toBe(4)
  expect(await walk(page, 'ArrowUp', 4), '縦道を北へ 4 マス').toBe(4)
  expect(await walk(page, 'ArrowLeft', 1), '灯の裏へ 1 マス').toBe(1)
  expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 9, y: 8 } })
  // 席はクラス名ではなく取っ手で指す(CSS Modules のクラス名は毎ビルド変わる)。
  // 重なっている間だけ席に data-village-veil-on が付き、灯と柱で 2 つ並ぶ
  const veiled = page.locator('[data-village-veil] > [data-village-veil-on]')
  await expect(veiled, '灯と柱の 2 マス分が主人公の上へ重なる').toHaveCount(2)
  // 真南 (9,9) は柱の根元で通行不可。下を押しても向きが変わるだけで 1 マスも進まない
  expect(await walk(page, 'ArrowDown', 1), '柱の根元へは踏み込めない').toBe(0)
  expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 9, y: 8 } })
  // 縦道 (10,8) へ戻れば絵の外。ここでは今までどおり主人公が街灯より手前に描かれる
  expect(await walk(page, 'ArrowRight', 1), '縦道へ 1 マス戻る').toBe(1)
  expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 10, y: 8 } })
  await expect(veiled, '絵のマスを離れたら重ならない').toHaveCount(0)
})

// ポストの正規の会話マスは上の (24,13) だが、下の (24,15) からも話しかけられる。
// 吹き出しを正規の会話マスの頭上に付けていた頃は主人公より 2 マス余り上へ浮き、
// iPhone 13 の縦持ちで枠(overflow: hidden)の上へ 16px はみ出して切れた。
// 吹き出しを付ける位置は言語で変わらないので ja だけ見る。
// devices[] は defaultBrowserType を含み describe 内で使えないため、iPhone 13 の寸法と入力種別だけ指定する
test.describe('ポストの下から話しかける (/)', () => {
  test.use({
    viewport: { width: 390, height: 664 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  })

  test('吹き出しが枠の上で切れない', async ({ page }) => {
    const mailbox = villageJa.stops.mailbox
    // 再読み込みは位置を戻さないので、保存を差し込まずに歩いて行く
    await openVillage(page, '')
    await leaveRoom(page)
    // 自宅前 (14,12) から右 9・下 3・右 1 で (24,15)。上を押すとポストに阻まれて向きだけ変わる
    await walk(page, 'ArrowRight', 9)
    await walk(page, 'ArrowDown', 3)
    await walk(page, 'ArrowRight', 1)
    await walk(page, 'ArrowUp', 1)
    expect(await readCell(page)).toEqual({ worldId: 'town', cell: { x: 24, y: 15 } })
    const bubble = page.locator('[data-village-bubble]')
    await expect(bubble).toContainText(
      mailbox.arrive ?? villageJa.arriveAt.replace('{place}', mailbox.place)
    )
    const tops = await bubble.evaluate(el => {
      const frame = el.closest('[data-village]')
      if (frame === null) throw new Error('吹き出しが枠の中に無い')
      return {
        frame: frame.getBoundingClientRect().top,
        bubble: el.getBoundingClientRect().top,
      }
    })
    expect(tops.bubble).toBeGreaterThanOrEqual(tops.frame)
  })
})
