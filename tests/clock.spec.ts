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

// 次のフレームの描画が終わるまで待つ。スティックの向きは rAF で読まれるので、倒した後にこれを挟めば
// 「押した瞬間」の 1 つは処理済みで、押し続けた時の繰り返し(300ms 以上先)にはまだ届かない
const waitTwoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
  )

// 操作帯のスティックの中心。倒す向きはここからの差で決まる(journey.spec のスティックの検査と同じ掴み方)
const stickCenter = async (page: Page, text: VillageText) => {
  const stick = await page.getByRole('application', { name: text.joystick }).boundingBox()
  if (stick === null) throw new Error('スティックが無い')
  return { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2 }
}

// 2次の時が 18 時から何ステップ進んだか。0 時を跨いでも数えられるよう 24 で丸める
const hourStepsFrom18 = async (clockWindow: Locator) => {
  const hour = Number(await clockWindow.locator(HOUR).textContent())
  return (hour - 18 + 24) % 24
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

  test(`1次の窓は矢印キーでボタンを移れる (${label})`, async ({ page }) => {
    await startAtClock(page, prefix, clock)
    const clockWindow = page.locator(CLOCK_WINDOW)
    const realtime = clockWindow.getByRole('button', { name: clock.realtime })
    const custom = clockWindow.getByRole('button', { name: clock.custom })
    const cancel = clockWindow.getByRole('button', { name: clock.cancel })

    await openClock(page)
    await expect(clockWindow).toHaveAttribute('data-step', 'choose')
    await expect(realtime, '開いた直後の焦点は先頭の現在時間').toBeFocused()

    // 下・右が次、上・左が前。1 回押すごとに 1 つだけ移る(2 つ飛べば枠側でも数えている)
    await page.keyboard.press('ArrowDown')
    await expect(custom, '下 1 回でカスタム時間').toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(cancel, '下もう 1 回でやめる').toBeFocused()
    // 末尾から先は先頭へ回り込む
    await page.keyboard.press('ArrowDown')
    await expect(realtime, 'やめるの次は現在時間へ回り込む').toBeFocused()
    // 先頭から前は末尾へ回り込む
    await page.keyboard.press('ArrowUp')
    await expect(cancel, '現在時間の前はやめるへ回り込む').toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(realtime, '右も下と同じく次へ').toBeFocused()
    // 焦点を移しただけで、どのボタンも押されていない
    await expect(clockWindow).toHaveAttribute('data-step', 'choose')
  })

  test(`2次の窓は矢印キーで時と分を動かせる (${label})`, async ({ page }) => {
    await startAtClock(page, prefix, clock)
    const clockWindow = page.locator(CLOCK_WINDOW)

    await openClock(page)
    await clockWindow.getByRole('button', { name: clock.custom }).click()
    await expect(clockWindow).toHaveAttribute('data-step', 'pick')
    // 2次へ入ると焦点は決定へ移る。A(Z)がそのまま決定になる前提
    await expect(
      clockWindow.getByRole('button', { name: clock.decide }),
      '2次へ入った時点の焦点は決定'
    ).toBeFocused()
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

  test(`2次で A(Z) を押すと決定される (${label})`, async ({ page }) => {
    await startAtClock(page, prefix, clock)
    const root = page.locator(VILLAGE_ROOT)
    const clockWindow = page.locator(CLOCK_WINDOW)

    await openClock(page)
    await clockWindow.getByRole('button', { name: clock.custom }).click()
    await expect(clockWindow).toHaveAttribute('data-step', 'pick')
    await expect(clockWindow.getByRole('button', { name: clock.decide })).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expectPicked(clockWindow, '20', '00')
    // 焦点は決定に置かれたままなので、Z(画面の A)がそのまま決定を押す
    await page.keyboard.press('z')
    await expect(clockWindow).toHaveCount(0)
    // 20 時は夜の帯。決定されていなければ昼のまま落ちる
    await expect(root, 'Z で決定されて夜になる').toHaveAttribute('data-phase', 'night')
    await expect(page.getByRole('status')).toContainText(clock.setCustom.replace('{time}', '20:00'))
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

  // タッチ端末ではキーボードが無く、窓の操作は操作帯のスティックと A/B だけになる。
  // 寸法と入力種別は journey.spec の A/B ボタンの検査と揃える
  test.describe(`スティックと A/B (${label})`, () => {
    test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true })
    // 画面の A は aria-label が窓の「決定」と同じ名前になるので、役割と名前ではなく data 属性で掴む
    const buttonA = '[data-village-action="a"]'

    test(`1次の窓はスティックでボタンを移り、A で押せる`, async ({ page }) => {
      // 時計の前までは村の枠へ焦点を置いてキーで歩く(startAtClock が枠へ焦点を渡す)。検査の対象は窓の中だけ
      await startAtClock(page, prefix, clock)
      const root = page.locator(VILLAGE_ROOT)
      const clockWindow = page.locator(CLOCK_WINDOW)
      const custom = clockWindow.getByRole('button', { name: clock.custom })
      const cancel = clockWindow.getByRole('button', { name: clock.cancel })

      await page.locator(buttonA).tap()
      await expect(clockWindow).toHaveAttribute('data-step', 'choose')
      await expect(clockWindow.getByRole('button', { name: clock.realtime })).toBeFocused()

      const { x, y } = await stickCenter(page, text)
      await page.mouse.move(x, y)
      await page.mouse.down()
      // 右へ倒して 2 フレーム処理させてから中央へ戻す。確かめる側の待ちで繰り返しが走り、
      // 焦点が 2 つ先まで流れないようにする
      await page.mouse.move(x + 30, y)
      await waitTwoFrames(page)
      await page.mouse.move(x, y)
      await expect(custom, 'スティックの右 1 回でカスタム時間').toBeFocused()
      // 中央で離したことを 1 フレーム以上読ませてから倒し直す(押し直しとして数えさせる)
      await page.waitForTimeout(50)
      await page.mouse.move(x + 30, y)
      await waitTwoFrames(page)
      await page.mouse.move(x, y)
      await expect(cancel, 'もう 1 回でやめる').toBeFocused()
      await page.mouse.up()

      // A は焦点のボタンを押す。やめるなので何も変えずに閉じる
      await page.locator(buttonA).tap()
      await expect(clockWindow).toHaveCount(0)
      await expect(root, 'やめるでは段階が変わらない').toHaveAttribute('data-phase', 'day')
    })

    test(`2次の窓はスティックを倒し続けると時が進み続け、A で決定できる`, async ({ page }) => {
      await startAtClock(page, prefix, clock)
      const root = page.locator(VILLAGE_ROOT)
      const clockWindow = page.locator(CLOCK_WINDOW)

      await page.locator(buttonA).tap()
      await expect(clockWindow).toHaveAttribute('data-step', 'choose')

      const { x, y } = await stickCenter(page, text)
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 30, y)
      await waitTwoFrames(page)
      await page.mouse.move(x, y)
      await page.mouse.up()
      await expect(clockWindow.getByRole('button', { name: clock.custom })).toBeFocused()

      // A でカスタム時間を押して2次へ。焦点は決定へ移る
      await page.locator(buttonA).tap()
      await expect(clockWindow).toHaveAttribute('data-step', 'pick')
      await expect(clockWindow.getByRole('button', { name: clock.decide })).toBeFocused()
      await expectPicked(clockWindow, '18', '00')

      // 右へ倒したまま離さない。押した瞬間に 1 つ、少し待ってからは繰り返して進む。
      // 何時まで進むかは倒していた時間次第なので、18 時からのステップ数で見る(0 時を跨いでも数えられる)
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + 30, y)
      await expect
        .poll(() => hourStepsFrom18(clockWindow), { message: '押した瞬間に 1 つ進む' })
        .toBeGreaterThanOrEqual(1)
      await page.waitForTimeout(600)
      await expect
        .poll(() => hourStepsFrom18(clockWindow), { message: '倒し続けると繰り返して進む' })
        .toBeGreaterThanOrEqual(2)
      await page.mouse.move(x, y)
      await page.mouse.up()

      // 離した後は止まる。止まった値を決定の一言と突き合わせる
      await waitTwoFrames(page)
      const hour = await clockWindow.locator(HOUR).textContent()
      await page.waitForTimeout(300)
      await expect(clockWindow.locator(HOUR), '離した後は進まない').toHaveText(hour ?? '')

      await page.locator(buttonA).tap()
      await expect(clockWindow).toHaveCount(0)
      // 18 時より後(夜の帯)を決めたので昼から変わる
      await expect(root, 'A で決定されて昼から変わる').not.toHaveAttribute('data-phase', 'day')
      await expect(page.getByRole('status')).toContainText(
        clock.setCustom.replace('{time}', `${hour}:00`)
      )
    })
  })
}
