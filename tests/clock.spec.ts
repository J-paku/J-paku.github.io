// 自室の卓上時計の E2E。時計の前 (7,3) で話しかけると開く設定窓で 20:00 を決め、
// 村の段階(data-phase)と夜の灯りに効き、町へ出ても続くのに、再読み込みでは実時刻へ戻ることを見る。
// 再読み込みは統合テストの中では作れない(読み込み直すとテストごと消える)ので、この 1 本を E2E に残す。
// 窓の操作(1次と2次・取消し・Escape・Z/X・矢印キー・スティックと A/B)と、再読み込みの前までの同じ流れは、
// 村の統合テスト(src/components/VillagePage/container.browser.test.tsx)が見る(docs/decisions/0018-move-e2e-and-gate-all-hooks.md)。
// 窓の操作も段階も灯りも言語では変わらないので ja だけで見る(docs/decisions/0015-trim-e2e-overlap-and-ko.md)
import { expect, type Locator, type Page } from '@playwright/test'
import type { ClockText, VillageText } from '@content/types/world'
import { village as villageJa } from '@content/ja/village'
// 村を開く手順・歩く walk(1 マスごとに到着を待つ)・昼の瞬間・既定で晴れを敷く test は
// 他の村の spec と共用。正本は village.helpers.ts。天気はこの spec の対象外なので、その既定の晴れのまま実ネットワークへ出さない
import { NOON_JST, focusVillage, openVillage, test, walk } from './village.helpers'

type Journey = { prefix: string; text: VillageText }

// 言語の接頭と文言は他の村の spec と同じ形で持ち回る(テストの題の (/) もそのまま)
const JOURNEYS: Journey[] = [{ prefix: '', text: villageJa }]

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
// 不透明度・面積を先祖まで遡って見る(村の統合テストの src/components/VillagePage/village-walk.test-helper.ts の isPainted と同じ物差し)
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

// 2次の窓で時と分の表示をまとめて確かめる
const expectPicked = async (clockWindow: Locator, hour: string, minute: string) => {
  await expect(clockWindow.locator(HOUR), `時が ${hour}`).toHaveText(hour)
  await expect(clockWindow.locator(MINUTE), `分が ${minute}`).toHaveText(minute)
}

// 時計の前まで歩いて昼(NOON_JST)から始める。どのテストも同じ出発点に揃え、「昼から変わったか」を段階で見る
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
}
