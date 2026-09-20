// 昼夜の空と天気の E2E。時計を4つの帯それぞれへ固定して村の段階と実シートを確かめ、
// Open-Meteo の応答を差し替えて雨の層が出る/出ないを確かめ、最後に段階と天気が載っても
// 5か所のコースが今までどおり完走することを ja/ko 双方で見る
import { expect, test, type Page } from '@playwright/test'
import type { VillageText } from '@content/types/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
import { DAY_PHASES, type DayPhase } from '@/utils/day-phase'

type Journey = { prefix: string; text: VillageText }

const JOURNEYS: Journey[] = [
  { prefix: '', text: villageJa },
  { prefix: '/ko', text: villageKo },
]

// 村は訪問者のタイムゾーンを見ず、常に大阪時刻(JST = UTC+9 固定、夏時間なし)で段階を決める。
// そのためここは UTC の瞬間を指定すれば足りる。括弧内はその瞬間を JST に直した時刻
const PHASE_CLOCKS: Record<DayPhase, string> = {
  // JST 2026-09-21 06:00 — 明け方の帯(5時〜7時)。UTC では前日の夜で、ずれの向きを一番よく突く
  dawn: '2026-09-20T21:00:00Z',
  // JST 2026-09-20 12:00 — 昼の帯(7時〜17時)
  day: '2026-09-20T03:00:00Z',
  // JST 2026-09-20 18:00 — 夕方の帯(17時〜19時)
  dusk: '2026-09-20T09:00:00Z',
  // JST 2026-09-20 22:00 — 夜の帯(19時〜翌5時)
  night: '2026-09-20T13:00:00Z',
}

// 村の根要素。data-phase に今の段階が載る
const VILLAGE_ROOT = '[data-phase]'
// 地面の層の先頭の子 = 最初の地形マス。Ground が world 層の先頭に並べるので、
// 主人公より前に来る。CSS Modules のクラス名は毎ビルド変わるので位置で指す
const GROUND_SPRITE = '[data-world] > div'
// 雨・雪の層。Weather が層ごとに data-weather を置き、値に降水の種類を載せる。
// 層は world 層ではなく表示枠(枠は視野ぶんしかないので描き替える面積が小さい)の子なので、
// world 層を起点にすると掴めない。クラス名は CSS Modules が毎ビルド変えるので使わない
const WEATHER_LAYERS = '[data-weather]'
const RAIN_LAYERS = '[data-weather="rain"]'
// 降っている間に並ぶ層の枚数。2 コマを不透明度で交互に見せ消しする作りなので、出ているなら必ず 2 枚。
// 1 枚しか無ければコマ送りが片側だけになっている状態で、「降っている」とは認めない
const WEATHER_LAYER_COUNT = 2

const OPEN_METEO = 'https://api.open-meteo.com/**'
// 降っていない応答。段階だけを見たいテストでもこれを敷いて実ネットワークへ出さない
const DRY = { precipitation: 0, snowfall: 0 }
const RAINING = { precipitation: 2.4, snowfall: 0 }

type WeatherStub = { calls: () => number }

// Open-Meteo をテストの外へ出さない。current が null の時は失敗応答(500)を返す。
// 戻り値の calls() で「実際に問い合わせが起きたか」を数え、応答前の空振り判定を防ぐ
const stubWeather = async (
  page: Page,
  current: { precipitation: number; snowfall: number } | null
): Promise<WeatherStub> => {
  let calls = 0
  await page.route(OPEN_METEO, route => {
    calls += 1
    if (current === null) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ current }),
    })
  })
  return { calls: () => calls }
}

// ブート演出が消えるまで待ち、キー操作を受け取る村の枠へフォーカスする(journey.spec と同じ手順)
const focusVillage = async (page: Page) => {
  await page.waitForSelector('#boot', { state: 'detached', timeout: 5_000 })
  await page.locator('[data-village]').focus()
}

const openVillage = async (page: Page, prefix: string) => {
  await page.goto(`${prefix}/`)
  await focusVillage(page)
}

// 村は自室(屋内)から始まる。天気は屋外にしか降らないので、雨を数えるテストは必ず町へ出てから測る。
// 歩き方の間合い(旋回だけで終わらせない押下時間と、到着を待つ時間)は journey.spec と同じ
const HOLD_MS = 150
const SETTLE_MS = 320

// 到着の文言で未取得の書体サブセットが届くと、その瞬間に舞台が再描画される。
// 描画が落ち着いてから数えるため、書体の到着と次フレームの描画完了まで待つ(journey.spec と同じ理由)
const settleRender = (page: Page) =>
  page.evaluate(() =>
    document.fonts.ready.then(
      () =>
        new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
  )

// 自室の下端 (4,7) のマットへ乗ると町の自宅前 (14,12) へ出る。開始マス (4,4) から下へ 3 マス
const leaveRoom = async (page: Page) => {
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.down('ArrowDown')
    await page.waitForTimeout(HOLD_MS)
    await page.keyboard.up('ArrowDown')
    await page.waitForTimeout(SETTLE_MS)
  }
  await settleRender(page)
  // 数える前に「今いるのは屋外」を確定させる。屋内のままだと天気は常に 0 枚で、
  // 雨が出ていようと出ていまいと素通りするテストになってしまう
  await expect(page.locator('[data-world]')).toHaveAttribute('data-world', 'town')
}

// 背景画像のデータURIは数KBあるので、長さと簡易チェックサムへ畳んでから比べる。
// PNG のデータURIであることも併せて返し、両方が none で「差がある」を取り逃さないようにする
const sheetDigest = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate(element => {
      const image = getComputedStyle(element).backgroundImage
      let sum = 0
      for (let i = 0; i < image.length; i += 1) sum = (sum * 31 + image.charCodeAt(i)) >>> 0
      return {
        png: image.includes('data:image/png;base64,'),
        digest: `${image.length}:${sum.toString(16)}`,
      }
    })

for (const { prefix, text } of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix
  const home = text.stops.home
  const meishi = text.stops.meishi
  const lab = text.stops.lab
  const robot = text.stops.robot
  const mailbox = text.stops.mailbox

  // DAY_PHASES を回すので、段階を足して PHASE_CLOCKS を書き忘れれば型で落ち、
  // 書けばこの網羅テストが自動で1本増える
  for (const phase of DAY_PHASES) {
    test(`時計を ${phase} の帯に固定すると村がその段階になる (${label})`, async ({ page }) => {
      await stubWeather(page, DRY)
      await page.clock.setFixedTime(new Date(PHASE_CLOCKS[phase]))
      await openVillage(page, prefix)

      await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', phase)
    })
  }

  test(`夜は属性だけでなく焼いたシートそのものが昼と入れ替わる (${label})`, async ({ page }) => {
    await stubWeather(page, DRY)
    await page.clock.setFixedTime(new Date(PHASE_CLOCKS.day))
    await openVillage(page, prefix)
    await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', 'day')
    const dayGround = await sheetDigest(page, GROUND_SPRITE)
    const dayPlayer = await sheetDigest(page, '[data-village-player]')
    expect(dayGround.png, '昼の地形シートがPNGのデータURIである').toBe(true)
    expect(dayPlayer.png, '昼の主人公シートがPNGのデータURIである').toBe(true)

    await page.clock.setFixedTime(new Date(PHASE_CLOCKS.night))
    await openVillage(page, prefix)
    await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', 'night')
    const nightGround = await sheetDigest(page, GROUND_SPRITE)
    const nightPlayer = await sheetDigest(page, '[data-village-player]')
    expect(nightGround.png, '夜の地形シートがPNGのデータURIである').toBe(true)
    expect(nightPlayer.png, '夜の主人公シートがPNGのデータURIである').toBe(true)

    // 属性が変わっただけでなく、要素へ解決される背景画像そのものが別物になっている
    expect(nightGround.digest, '地形シートが夜で入れ替わる').not.toBe(dayGround.digest)
    expect(nightPlayer.digest, '主人公シートが夜で入れ替わる').not.toBe(dayPlayer.digest)
  })

  test(`大阪が雨なら雨の層が出て、読み上げからは外れる (${label})`, async ({ page }) => {
    const weather = await stubWeather(page, RAINING)
    await page.clock.setFixedTime(new Date(PHASE_CLOCKS.day))
    await openVillage(page, prefix)

    // 実ネットワークではなくこのテストの応答を見て描いたことを先に押さえる
    await expect.poll(() => weather.calls(), { timeout: 10_000 }).toBeGreaterThan(0)
    // 自室には天井があるので、雨だと分かっていても屋内では降らせない
    await expect(page.locator(WEATHER_LAYERS), '屋内では降らない').toHaveCount(0)

    await leaveRoom(page)
    // 属性の値まで見るので、雪の層が出ていても「雨が降った」とは数えない
    const layers = page.locator(RAIN_LAYERS)
    await expect(layers, '雨は 2 コマぶんの層が並ぶ').toHaveCount(WEATHER_LAYER_COUNT)
    // 2 枚とも読み上げから外れていること。片方だけだと支援技術に粒の層が残る
    await expect(layers.nth(0)).toHaveAttribute('aria-hidden', 'true')
    await expect(layers.nth(1)).toHaveAttribute('aria-hidden', 'true')
  })

  test(`天気の取得が失敗したら何も降らせず村は動く (${label})`, async ({ page }) => {
    const weather = await stubWeather(page, null)
    await page.clock.setFixedTime(new Date(PHASE_CLOCKS.day))
    await openVillage(page, prefix)

    // 問い合わせが済んでから数える。応答前に数えると「まだ出ていない」を通してしまう
    await expect.poll(() => weather.calls(), { timeout: 10_000 }).toBeGreaterThan(0)
    // 取得に失敗しても村の描画と会話はそのまま動く
    await expect(page.locator('[data-village]')).toBeVisible()
    const dialog = page.getByRole('dialog')
    await page.keyboard.press('e')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    // 降る場所(屋外)まで出てから数える。屋内で数えても常に 0 枚なので、
    // 取得が成功していたとしても素通りしてしまい、何も証明できない。
    // 種類も問わない — 雨に絞ると、誤って雪として降った時に見逃す
    await leaveRoom(page)
    await expect(page.locator(WEATHER_LAYERS), '失敗したら何も降らない').toHaveCount(0)
  })

  test(`夜で雨でも5か所のコースは最後まで通る (${label})`, async ({ page }) => {
    // 10s 待ちを4回連ねるので既定の30sを超える(journey.spec の完走テストと同じ理由)
    test.setTimeout(60_000)
    await stubWeather(page, RAINING)
    await page.clock.setFixedTime(new Date(PHASE_CLOCKS.night))
    await openVillage(page, prefix)
    await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', 'night')
    // 出発点の自室は屋内。ここではまだ降っていないのが正しい
    await expect(page.locator(WEATHER_LAYERS), '出発点の自室は屋内なので降らない').toHaveCount(0)

    const dialog = page.getByRole('dialog')
    await page.keyboard.press('e')
    await expect(dialog.getByRole('heading', { name: home.title })).toBeVisible()
    await dialog.getByRole('button', { name: home.next }).click()
    await expect(dialog.getByRole('heading', { name: meishi.title })).toBeVisible({
      timeout: 10_000,
    })
    // 自動歩行で町(屋外)へ出た最初の地点。ここから完走まで雨が降り続けるはず
    await expect(page.locator(RAIN_LAYERS), '町へ出た時点で雨が降っている').toHaveCount(
      WEATHER_LAYER_COUNT
    )
    await dialog.getByRole('button', { name: meishi.next }).click()
    await expect(dialog.getByRole('heading', { name: lab.title })).toBeVisible({ timeout: 10_000 })
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
    await expect(page.locator('[data-village-exit]')).toBeFocused()
    // 完走しても段階と雨はそのまま(コースの進行が空や天気を壊していない)。
    // 2 枚のうち片方でも落ちていればコマ送りが壊れているので、ここも枚数まで見る
    await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', 'night')
    await expect(page.locator(RAIN_LAYERS), '完走後も雨が降り続けている').toHaveCount(
      WEATHER_LAYER_COUNT
    )
  })
}
