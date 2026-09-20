// 昼夜の空と天気の E2E。時計を4つの帯それぞれへ固定して村の段階と実シートを確かめ、
// 夜の灯りがともって主人公に付いて回ること・昼は同じ要素が描かれないことを確かめ、
// Open-Meteo の応答を差し替えて雨の層が出る/出ないを確かめ、最後に段階と天気が載っても
// 5か所のコースが今までどおり完走することを ja/ko 双方で見る
import { expect, test, type Page } from '@playwright/test'
import type { VillageText } from '@content/types/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
import { DAY_PHASES, type DayPhase } from '@/utils/day-phase'
// 村を開く手順・歩きの間合い(旋回だけで終わらせない押下時間と、到着を待つ時間)・描画待ちは
// journey.spec と共用。正本は village.helpers.ts
import { HOLD_MS, SETTLE_MS, openVillage, settleRender } from './village.helpers'

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

// 夜の灯り。Lighting が world 層へ敷く光源で、data-village-light に光源の種類が載る。
// 主人公が持つ灯り(player)だけは use-walk-loop が人物と同じ transform を毎フレーム書く。
// 昼夜の出し分けは CSS([data-phase='night'])なので、昼でも要素自体は DOM に残る。
// クラス名は CSS Modules が毎ビルド変えるので使わない
const LIGHTS = '[data-village-light]'
const lightsOfKind = (kind: string) => `[data-village-light="${kind}"]`
const PLAYER_LIGHT = lightsOfKind('player')
// 夜の町にともる灯りの内訳。「1つ以上ある」だけを見ると主人公のランタン1つで通ってしまい、
// 街灯も窓もたき火も丸ごと消えたことに気付けないので、種類ごとの数をここで打つ。
// 期待値を worldLights から作らない — 検査対象で検査対象を測っても何も証明できないため、
// 実ブラウザで数えた値をそのまま書く。
// ★ 町の構成(content/world.ts の structures と家の窓の並び)を変えたら、この表も一緒に直す
const TOWN_LIGHTS = {
  lamp: 3, // 街灯 lamp-west / lamp-east / lamp-plaza
  window: 4, // 家の窓。自宅1・名刺1・研究所2(どのマスが窓かは facade.ts が決める)
  mailbox: 1, // ポスト前面の上辺に並ぶ 5 粒の LED(夜だけ点く。粒は 5 つでも光源は 1 つ)
  campfire: 1, // たき火(ゆらぎが付く唯一の光源)
  player: 1, // 主人公が提げるランタン。構造物ではなく Lighting が直接置く
} as const
// 上の表の合計。ここを別に書くと表と二重の正本になるので、必ず表から足す
const TOWN_LIGHT_TOTAL = Object.values(TOWN_LIGHTS).reduce((sum, count) => sum + count, 0)
// 人物と灯りの中心のずれの許容。両者は同じ transform を受けるので本来は 0 で、実測のまるめしか出ない。
// 追従が切れた灯りは歩き終えた人物から 1 マスぶん離れる。1 マスの px は画面の大きさで決まるが、
// use-stage-scale.ts の下限(CELL_MIN = 12px)を下回ることはないので、1px の許容とは取り違えようがない
const LIGHT_GAP_TOLERANCE_PX = 1

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

// 村は自室(屋内)から始まる。天気は屋外にしか降らないので、雨を数えるテストは必ず町へ出てから測る。
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

// 実際に描かれている灯りの数。昼夜の出し分けは CSS なので要素は昼も DOM に残り、枚数では
// 「消えている」を判定できない。どの手段で消していても取り逃さないよう、display・visibility・
// 不透明度・面積を先祖まで遡って見る。夜の合計(TOWN_LIGHT_TOTAL)も同じ物差しで数えるので、
// この数え方が常に 0 を返す作りなら夜の側が落ちて気付ける
const paintedLights = (page: Page) =>
  page.evaluate(selector => {
    const painted = (element: Element): boolean => {
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
    }
    return Array.from(document.querySelectorAll(selector)).filter(painted).length
  }, LIGHTS)

// 主人公と主人公の灯りの中心のずれを、同じ評価の中で両方の矩形を取って測る。
// 2回に分けて測ると移動中の1フレームぶんの差がそのままずれに化ける(カメラも毎フレーム動く)。
// 中心で見るのは、灯りが明滅で伸び縮みしても中心なら動かないため。
// pose には rAF が人物へ書いた transform がそのまま入る(本当に歩いたかの裏取りに使う)
const playerLightGap = (page: Page) =>
  page.evaluate(
    ([playerSelector, lightSelector]) => {
      const player = document.querySelector<HTMLElement>(playerSelector)
      const light = document.querySelector<HTMLElement>(lightSelector)
      if (player === null || light === null) return null
      const center = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      }
      const at = center(player)
      const lit = center(light)
      return { x: lit.x - at.x, y: lit.y - at.y, pose: player.style.transform }
    },
    ['[data-village-player]', PLAYER_LIGHT]
  )

// 焼いたシートはサイト内の /sprites/<種類>-<段階>.png に置く(実体は public/sprites/、
// 焼くのは scripts/build-sprites.mjs)。data URI をやめて実ファイルになったので、
// 符号化の形ではなく「サイトが配るシートの PNG を指しているか」で見る。
// 段階と拡張子の間には中身から導いた印(内容ハッシュ)が入ることがあるので、
// 決め打ちの名前ではなく形で照合する。段階の綴りは DAY_PHASES から組み、ここを第二の正本にしない
const SHEET_PATH = new RegExp(
  `^/sprites/(?:sprite|player)-(?:${DAY_PHASES.join('|')})(?:-[0-9a-zA-Z]+)?\\.png$`
)

// 背景画像の URL を長さと簡易チェックサムへ畳んでから比べる。併せて「サイト内の焼いた
// シート PNG を実際に読めているか」も返し、両方が none や 404 のときに
// 「差がある」を取り逃さないようにする
const sheetDigest = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate(async (element, pathPattern) => {
      const image = getComputedStyle(element).backgroundImage
      let sum = 0
      for (let i = 0; i < image.length; i += 1) sum = (sum * 31 + image.charCodeAt(i)) >>> 0
      const digest = `${image.length}:${sum.toString(16)}`

      // none・グラデーション・複数指定はここで落とす(url() 1本だけを認める)
      const single = /^url\((['"]?)(.+)\1\)$/.exec(image)
      if (single === null) return { sheet: false, digest }
      let url: URL
      try {
        url = new URL(single[2], location.href)
      } catch {
        return { sheet: false, digest }
      }
      // 外部の画像を掴んでいないこと(配信元が同じ)と、焼いたシートの名前の規則に合っていること
      if (url.origin !== location.origin || !new RegExp(pathPattern).test(url.pathname)) {
        return { sheet: false, digest }
      }
      // URL の形だけでは「out/ に実体が無い(404)」を見逃す。実際に読めて寸法が出るまで確かめる
      const drawable = await new Promise<boolean>(resolve => {
        const probe = new Image()
        probe.onload = () => resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0)
        probe.onerror = () => resolve(false)
        probe.src = url.href
      })
      return { sheet: drawable, digest }
    }, SHEET_PATH.source)

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
    expect(dayGround.sheet, '昼の地形シートがサイト内の焼いたシートPNGである').toBe(true)
    expect(dayPlayer.sheet, '昼の主人公シートがサイト内の焼いたシートPNGである').toBe(true)

    await page.clock.setFixedTime(new Date(PHASE_CLOCKS.night))
    await openVillage(page, prefix)
    await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', 'night')
    const nightGround = await sheetDigest(page, GROUND_SPRITE)
    const nightPlayer = await sheetDigest(page, '[data-village-player]')
    expect(nightGround.sheet, '夜の地形シートがサイト内の焼いたシートPNGである').toBe(true)
    expect(nightPlayer.sheet, '夜の主人公シートがサイト内の焼いたシートPNGである').toBe(true)

    // 属性が変わっただけでなく、要素へ解決される背景画像そのものが別物になっている
    expect(nightGround.digest, '地形シートが夜で入れ替わる').not.toBe(dayGround.digest)
    expect(nightPlayer.digest, '主人公シートが夜で入れ替わる').not.toBe(dayPlayer.digest)
  })

  test(`夜の町は灯りがともり、主人公の灯りは歩いても離れない (${label})`, async ({ page }) => {
    await stubWeather(page, DRY)
    await page.clock.setFixedTime(new Date(PHASE_CLOCKS.night))
    await openVillage(page, prefix)
    await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', 'night')
    // 街灯もたき火も町にある。屋内のまま数えると主人公の灯りしか見ないテストになる
    await leaveRoom(page)

    // 種類ごとに数を見る。合計だけだと、街灯が消えたぶん窓が増えたような入れ替わりを通してしまう
    for (const [kind, count] of Object.entries(TOWN_LIGHTS)) {
      await expect(
        page.locator(lightsOfKind(kind)),
        `夜の町に ${kind} の灯りが ${count} つ置かれている`
      ).toHaveCount(count)
    }
    // 置かれているだけでなく本当に描かれている(先祖まで遡って display・visibility・不透明度・面積を見る)。
    // 表に無い種類が増えていればこの合計がずれて落ちる
    expect(await paintedLights(page), '夜の町では表どおりの灯りがすべて描かれている').toBe(
      TOWN_LIGHT_TOTAL
    )

    const before = await playerLightGap(page)
    if (before === null) throw new Error('主人公か主人公の灯りが描かれていない')

    // 自宅前 (14,12) から右へ1マス(journey.spec が通れることを押さえている道)。
    // 押す・離す・到着を待つ間合いは leaveRoom と同じ
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(HOLD_MS)
    await page.keyboard.up('ArrowRight')
    await page.waitForTimeout(SETTLE_MS)
    await settleRender(page)

    const after = await playerLightGap(page)
    if (after === null) throw new Error('歩いた後に主人公か主人公の灯りが消えた')
    // 先に「本当に歩いた」を確かめる。動いていなければ、ずれが同じでも何も証明していない
    expect(after.pose, '人物へ書かれる transform が変わっている(実際に歩いた)').not.toBe(
      before.pose
    )
    // カメラも一緒に動くので画面の絶対座標では判定できない。人物と灯りの中心のずれが
    // 歩く前後で変わらないことだけが「灯りが人物に固定されている」を意味する
    expect(Math.abs(after.x - before.x), '灯りが横に置いていかれていない').toBeLessThanOrEqual(
      LIGHT_GAP_TOLERANCE_PX
    )
    expect(Math.abs(after.y - before.y), '灯りが縦に置いていかれていない').toBeLessThanOrEqual(
      LIGHT_GAP_TOLERANCE_PX
    )
  })

  test(`昼は灯りの要素が残ったまま一つも描かれない (${label})`, async ({ page }) => {
    await stubWeather(page, DRY)
    await page.clock.setFixedTime(new Date(PHASE_CLOCKS.day))
    await openVillage(page, prefix)
    await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', 'day')
    // 夜と同じ場所で数える。屋内で数えても町の光源は元から無いので、消えた証明にならない
    await leaveRoom(page)

    // 段階が変わるたびに層を組み直さない作りなので、要素は昼も DOM に残っているのが正しい。
    // 枚数が 0 なのを合格にすると、そもそも描いていない場合と見分けが付かなくなる
    await expect(page.locator(PLAYER_LIGHT), '灯りの要素自体は昼でも DOM にある').toBeAttached()
    expect(await paintedLights(page), '昼は灯りが一つも描かれない').toBe(0)
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
