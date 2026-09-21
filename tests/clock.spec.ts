// 自室の卓上時計の E2E。時計の前 (7,3) で話しかけると開く設定窓を、
// 1次(現在時間・カスタム・やめる)と2次(時刻を選ぶ)の両方でたどり、
// 決めた時刻が村の段階(data-phase)と夜の灯りに本当に効くこと・取消しと Escape では
// 何も変わらないこと・画面の A/B と同じ Z/X でも決定と取りやめができること・
// 町へ出ても続くのに再読み込みでは実時刻へ戻ることを ja/ko 双方で見る
import { expect, type Locator, type Page } from '@playwright/test'
import type { ClockText, VillageText } from '@content/types/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・既定で晴れを敷く test は他の村の spec と共用。
// 正本は village.helpers.ts。天気はこの spec の対象外なので、その既定の晴れのまま実ネットワークへ出さない
import { focusVillage, openVillage, test, walk } from './village.helpers'

type Journey = { prefix: string; text: VillageText }

const JOURNEYS: Journey[] = [
  { prefix: '', text: villageJa },
  { prefix: '/ko', text: villageKo },
]

// 村の根要素。data-phase に今の段階が載る
const VILLAGE_ROOT = '[data-phase]'
// 時計の設定窓。クラス名は CSS Modules が毎ビルド変えるので data 属性で掴む
const CLOCK_WINDOW = '[data-village-clock]'
// 2次の時刻表示。時は "18"、分は2桁の "00"
const HOUR = '[data-clock-hour]'
const MINUTE = '[data-clock-minute]'
// 地点に立った時に足元へ出る吹き出し(結果の一言は下の SpeechBox = role=status の側へ出る)
const BUBBLE = '[data-village-bubble]'
// 主人公が提げるランタン。夜だけ描かれるので「時刻が本当に変わったか」の裏取りに使う
const PLAYER_LIGHT = '[data-village-light="player"]'

// 村は訪問者のタイムゾーンを見ず、常に大阪時刻(JST = UTC+9 固定)で段階を決めるので
// UTC の瞬間だけを固定すれば足りる。これは JST 2026-09-20 12:00 = 昼の帯(7時〜17時)。
// どのテストもここから始め、「昼から変わったか」を段階で見る
const NOON_JST = '2026-09-20T03:00:00Z'

// 部屋の開始マス (4,4) から時計の前 (7,3) へ。右 3 マスは PC 机(3〜5列・2〜3行)の下、
// テーブル(6〜7列・5〜6行)の上を通る行なので素通りでき、最後の上 1 マスで卓上時計 (7,2) と向き合う
const walkToClock = async (page: Page) => {
  await walk(page, 'ArrowRight', 3)
  await walk(page, 'ArrowUp', 1)
}

// 時計の前 (7,3) から町へ出る。PC 机が 3〜5列・2〜3行を塞ぐので 3 行目を左へは抜けられない。
// いったん 4 行目へ降りてから左 3・下 3 でマット (4,7) に乗り、自宅前 (14,12) へワープする
const leaveRoom = async (page: Page) => {
  await walk(page, 'ArrowDown', 1)
  await walk(page, 'ArrowLeft', 3)
  await walk(page, 'ArrowDown', 3)
  await expect(page.locator('[data-world]')).toHaveAttribute('data-world', 'town')
}

// 窓を開く。閉じた後に開き直す時も確実に届くよう、キーを受け取る枠へ焦点を戻してから押す
const openClock = async (page: Page) => {
  await page.locator('[data-village]').focus()
  await page.keyboard.press('e')
}

// 主人公のランタンが本当に描かれているか。昼夜の出し分けは CSS なので要素は昼も DOM に残り、
// 「ある・ない」では判定できない。どの手段で消していても取り逃さないよう、display・visibility・
// 不透明度・面積を先祖まで遡って見る(day-night.spec の paintedLights と同じ物差し)
const playerLightPainted = (page: Page) =>
  page.evaluate(selector => {
    const element = document.querySelector(selector)
    if (element === null) return false
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    let node: Element | null = element
    while (node !== null) {
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      if (Number(style.opacity) === 0) return false
      node = node.parentElement
    }
    return true
  }, PLAYER_LIGHT)

// 焦点が窓の中にあるか。矢印キーの検査は「窓に焦点がある」が前提なので、
// 押す前にこれを確かめておかないと、落ちた時に「鍵が効かない」と「焦点が村側に残っていた」を
// 見分けられない
const focusInside = (clockWindow: Locator) =>
  clockWindow.evaluate(element => element.contains(document.activeElement))

// 2次の窓で時と分の表示をまとめて確かめる
const expectPicked = async (clockWindow: Locator, hour: string, minute: string) => {
  await expect(clockWindow.locator(HOUR), `時が ${hour}`).toHaveText(hour)
  await expect(clockWindow.locator(MINUTE), `分が ${minute}`).toHaveText(minute)
}

// 時計の前まで歩いて昼から始める。どのテストも同じ出発点に揃える
const startAtClock = async (page: Page, prefix: string, clock: ClockText) => {
  await page.clock.setFixedTime(new Date(NOON_JST))
  await openVillage(page, prefix)
  await expect(page.locator(VILLAGE_ROOT), '出発は実時刻の昼').toHaveAttribute('data-phase', 'day')
  await walkToClock(page)
  await expect(page.locator(BUBBLE), '時計の前に立つと吹き出しが出る').toContainText(clock.arrive, {
    timeout: 3_000,
  })
}

for (const { prefix, text } of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix
  const clock = text.clock

  test(`卓上時計で 20:00 を決めると夜になり、町へ出ても続き、再読み込みで実時刻へ戻る (${label})`, async ({
    page,
  }) => {
    await startAtClock(page, prefix, clock)
    const root = page.locator(VILLAGE_ROOT)
    // 変える前に「昼は主人公のランタンが描かれていない」を押さえる。後の描かれている側だけを
    // 見ると、元から点きっぱなしの作りでも通ってしまい何も証明できない
    expect(await playerLightPainted(page), '昼のうちはランタンが描かれない').toBe(false)

    const clockWindow = page.locator(CLOCK_WINDOW)
    await openClock(page)
    await expect(clockWindow, '設定窓は読み上げ上もダイアログ').toHaveRole('dialog')
    await expect(clockWindow).toHaveAttribute('aria-modal', 'true')
    await expect(clockWindow).toHaveAttribute('data-step', 'choose')
    await expect(clockWindow).toContainText(clock.prompt)

    await clockWindow.getByRole('button', { name: clock.custom }).click()
    await expect(clockWindow).toHaveAttribute('data-step', 'pick')
    await expect(clockWindow).toContainText(clock.customIntro)
    await expect(clockWindow).toContainText(clock.pick)
    // 何も押していない間の既定は 18:00。分は 2 桁で出す
    await expectPicked(clockWindow, '18', '00')

    await clockWindow.getByRole('button', { name: clock.nextHour }).click()
    await clockWindow.getByRole('button', { name: clock.nextHour }).click()
    await expectPicked(clockWindow, '20', '00')
    await clockWindow.getByRole('button', { name: clock.decide }).click()
    await expect(clockWindow).toHaveCount(0)

    // 決めた時刻がそのまま段階になる(20 時は夜の帯)
    await expect(root).toHaveAttribute('data-phase', 'night')
    await expect(page.getByRole('status')).toContainText(clock.setCustom.replace('{time}', '20:00'))
    // 属性だけでなく夜の描画まで届いている
    await expect.poll(() => playerLightPainted(page), { timeout: 3_000 }).toBe(true)

    // 屋内で決めた時刻は、町へ出ても続く(ワールドを跨いでも覚えている)
    await leaveRoom(page)
    await expect(root, '町へ出ても夜のまま').toHaveAttribute('data-phase', 'night')
    expect(await playerLightPainted(page), '町でもランタンが描かれている').toBe(true)

    // 覚えているのはこの読み込みの間だけ。開き直せば実時刻(JST 12:00 = 昼)へ戻る
    await page.reload()
    await focusVillage(page)
    await expect(root, '再読み込みで実時刻の昼へ戻る').toHaveAttribute('data-phase', 'day')
    expect(await playerLightPainted(page), '昼へ戻ればランタンも消える').toBe(false)
  })

  test(`カスタム時間の後に現在時間を選ぶと実時刻へ戻る (${label})`, async ({ page }) => {
    await startAtClock(page, prefix, clock)
    const root = page.locator(VILLAGE_ROOT)
    const clockWindow = page.locator(CLOCK_WINDOW)

    // まず 20:00 を決めて昼から夜へ動かす
    await openClock(page)
    await clockWindow.getByRole('button', { name: clock.custom }).click()
    await clockWindow.getByRole('button', { name: clock.nextHour }).click()
    await clockWindow.getByRole('button', { name: clock.nextHour }).click()
    await clockWindow.getByRole('button', { name: clock.decide }).click()
    await expect(clockWindow).toHaveCount(0)
    await expect(root).toHaveAttribute('data-phase', 'night')

    // 開き直して2次へ入ると、既定は 18:00 ではなく前に決めた 20:00
    await openClock(page)
    await clockWindow.getByRole('button', { name: clock.custom }).click()
    await expect(clockWindow).toHaveAttribute('data-step', 'pick')
    await expectPicked(clockWindow, '20', '00')
    await clockWindow.getByRole('button', { name: clock.cancel }).click()
    await expect(clockWindow).toHaveCount(0)
    await expect(root, '取消しなので夜のまま').toHaveAttribute('data-phase', 'night')

    // 現在時間を選べば実時刻(JST 12:00 = 昼)へ戻る
    await openClock(page)
    await expect(clockWindow).toHaveAttribute('data-step', 'choose')
    await clockWindow.getByRole('button', { name: clock.realtime }).click()
    await expect(clockWindow).toHaveCount(0)
    await expect(root).toHaveAttribute('data-phase', 'day')
    await expect(page.getByRole('status')).toContainText(clock.setRealtime)
    expect(await playerLightPainted(page), '昼へ戻ればランタンも消える').toBe(false)
  })

  test(`取消すと時計を触る前の時間のままになる (${label})`, async ({ page }) => {
    await startAtClock(page, prefix, clock)
    const root = page.locator(VILLAGE_ROOT)
    const clockWindow = page.locator(CLOCK_WINDOW)

    // 2次で時刻を動かしてから取消す。19 時は夜の帯なので、誤って決まっていれば段階が変わって落ちる
    await openClock(page)
    await clockWindow.getByRole('button', { name: clock.custom }).click()
    await clockWindow.getByRole('button', { name: clock.nextHour }).click()
    await expectPicked(clockWindow, '19', '00')
    await clockWindow.getByRole('button', { name: clock.cancel }).click()
    await expect(clockWindow).toHaveCount(0)
    await expect(root, '取消しでは段階が変わらない').toHaveAttribute('data-phase', 'day')
    await expect(page.getByRole('status')).toContainText(clock.cancelled)

    // 1次の取消しも同じく何も変えずに閉じるだけ
    await openClock(page)
    await expect(clockWindow).toHaveAttribute('data-step', 'choose')
    await clockWindow.getByRole('button', { name: clock.cancel }).click()
    await expect(clockWindow).toHaveCount(0)
    await expect(root, '1次の取消しでも段階が変わらない').toHaveAttribute('data-phase', 'day')
  })

  test(`2次の窓は矢印キーで時と分を動かせる (${label})`, async ({ page }) => {
    await startAtClock(page, prefix, clock)
    const clockWindow = page.locator(CLOCK_WINDOW)

    await openClock(page)
    await clockWindow.getByRole('button', { name: clock.custom }).click()
    await expect(clockWindow).toHaveAttribute('data-step', 'pick')
    await expectPicked(clockWindow, '18', '00')
    // 矢印キーは窓に焦点がある時だけ届く。押す前にそこを確かめておく
    expect(await focusInside(clockWindow), '窓を開いた時点で焦点は窓の中にある').toBe(true)

    // 左右が時の ±1
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(clockWindow.locator(HOUR), '右 2 回で 20 時').toHaveText('20')
    // 上下が分の ±10
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await expect(clockWindow.locator(MINUTE), '上 3 回で 30 分').toHaveText('30')

    // 0 時を跨いでも止まらずに一周する(20 - 21 = -1 → 23 時)
    for (let i = 0; i < 21; i += 1) {
      await page.keyboard.press('ArrowLeft')
    }
    await expect(clockWindow.locator(HOUR), '左 21 回で 23 時へ回り込む').toHaveText('23')
    // 分も 0 分を跨いで一周する(30 - 40 = -10 → 50 分)。時が繰り下がるかは決めていないので見ない
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('ArrowDown')
    }
    await expect(clockWindow.locator(MINUTE), '下 4 回で 50 分へ回り込む').toHaveText('50')
  })

  test(`Z/X でも時計の窓を決定・閉じられる (${label})`, async ({ page }) => {
    await startAtClock(page, prefix, clock)
    const root = page.locator(VILLAGE_ROOT)
    const clockWindow = page.locator(CLOCK_WINDOW)

    // Z/X を受け取る onKeyDown は村の枠([data-village])側にあり、設定窓はその枠の子として
    // 描かれる。窓の中のボタンに焦点があっても伝播で枠まで届く前提なので、まず焦点が
    // 窓の中にあることを押さえてから押す(落ちた時に「Z が効かない」と「焦点が村側に残っていた」を
    // 見分けられるようにする)
    await openClock(page)
    await expect(clockWindow).toHaveAttribute('data-step', 'choose')
    expect(await focusInside(clockWindow), '窓を開いた時点で焦点は窓の中にある').toBe(true)

    // 開いた直後の焦点は先頭の「現在時間」。そこで Z を押すと窓が閉じてしまい
    // 「窓の中のボタンが押された」ことを段階で確かめられないので、Tab 1 回で
    // 「カスタム時間」へ移してから押す
    await page.keyboard.press('Tab')
    await expect(
      clockWindow.getByRole('button', { name: clock.custom }),
      'Tab 1 回でカスタム時間へ焦点が移る'
    ).toBeFocused()

    // Z は画面の A ボタンと同じ。焦点のあるボタンを押すので 2次(時刻を選ぶ)へ進む
    await page.keyboard.press('z')
    await expect(clockWindow, 'Z でカスタム時間が押されて2次へ進む').toHaveAttribute(
      'data-step',
      'pick'
    )
    await expectPicked(clockWindow, '18', '00')

    // X は画面の B ボタンと同じで、決定ではなく閉じるだけ。既定の 18 時は夕方の帯なので、
    // 閉じ際に決まっていれば段階が day から変わって落ちる
    await page.keyboard.press('x')
    await expect(clockWindow).toHaveCount(0)
    await expect(root, 'X は閉じるだけなので段階が変わらない').toHaveAttribute('data-phase', 'day')
  })

  test(`Escape で窓を閉じても時間は変わらない (${label})`, async ({ page }) => {
    await startAtClock(page, prefix, clock)
    const root = page.locator(VILLAGE_ROOT)
    const clockWindow = page.locator(CLOCK_WINDOW)

    await openClock(page)
    await expect(clockWindow).toHaveAttribute('data-step', 'choose')
    await page.keyboard.press('Escape')
    await expect(clockWindow).toHaveCount(0)
    await expect(root, '1次を閉じただけでは段階が変わらない').toHaveAttribute('data-phase', 'day')

    // 2次で時刻を動かした後でも、Escape は決定ではなく取りやめ。
    // 19 時は夜の帯なので、閉じ際に決まっていれば段階が変わって落ちる
    await openClock(page)
    await clockWindow.getByRole('button', { name: clock.custom }).click()
    await expect(clockWindow).toHaveAttribute('data-step', 'pick')
    await clockWindow.getByRole('button', { name: clock.nextHour }).click()
    await expectPicked(clockWindow, '19', '00')
    await page.keyboard.press('Escape')
    await expect(clockWindow).toHaveCount(0)
    await expect(root, '2次を閉じただけでは段階が変わらない').toHaveAttribute('data-phase', 'day')
  })
}
