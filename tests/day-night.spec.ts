// 昼夜の E2E。時計を4つの帯それぞれへ固定して、4段階ぶんの焼いたシートがどれも別物であることを確かめ、
// 夜で雨でも8か所のコースが ko の文言のまま最後まで通ることを見る。
// 焼いたシートはビルドが焼く /sprites/ の PNG で、統合テストでは描かれないので E2E に残す。
// ko の完走は、統合のフィクスチャが ja の props だけを渡すので E2E に残す。
// 段階の属性・夜の灯り・雨と雪の層・天気の取得失敗・ja の完走は、村の統合テスト
// (src/components/VillagePage/container.browser.test.tsx)が見る(docs/decisions/0018-move-e2e-and-gate-all-hooks.md)
import { expect, type Page } from '@playwright/test'
import type { VillageText } from '@content/types/world'
import { village as villageJa } from '@content/ja/village'
import { village as villageKo } from '@content/ko/village'
import { DAY_PHASES, type DayPhase } from '@/utils/day-phase'
// 村を開く手順・天気の差し替え(stubWeather)と、既定で晴れを敷く test は他の村の spec と共用。正本は village.helpers.ts
import { openVillage, stubWeather, test } from './village.helpers'

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
// 地形の箱(data-village-terrain)の先頭の子 = 最初の地形マス。Ground は地形マスをこの箱に
// まとめて world 層へ置くので、world 層の直下を指すと先頭は背景を持たない箱そのものになる。
// CSS Modules のクラス名は毎ビルド変わるので、箱の data 属性から位置で指す
const GROUND_SPRITE = '[data-village-terrain] > div'
// 雨・雪の層。Weather が層ごとに data-weather を置き、値に降水の種類を載せる。
// 層は world 層ではなく表示枠(枠は視野ぶんしかないので描き替える面積が小さい)の子なので、
// world 層を起点にすると掴めない。クラス名は CSS Modules が毎ビルド変えるので使わない
const WEATHER_LAYERS = '[data-weather]'
const RAIN_LAYERS = '[data-weather="rain"]'
// 降っている間に並ぶ層の枚数。2 コマを不透明度で交互に見せ消しする作りなので、出ているなら必ず 2 枚。
// 1 枚しか無ければコマ送りが片側だけになっている状態で、「降っている」とは認めない
const WEATHER_LAYER_COUNT = 2

// 天気は helpers の test が context へ既定で晴れを敷くので、段階だけを見たいテストは何も敷かない。
// 雨の中の完走だけが stubWeather(page, 'rain') で page へ敷いて上書きする
// (page の route は context の route より先に効く)

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
// 「差がある」を取り逃さないようにする。
// pseudoは背景を描く疑似要素。主人公の絵は箱からはみ出す::beforeが描く(scene.module.cssの.player::before)
const sheetDigest = (page: Page, selector: string, pseudo: string | null = null) =>
  page
    .locator(selector)
    .first()
    .evaluate(
      async (element, [pathPattern, pseudoElement]) => {
        const image = getComputedStyle(element, pseudoElement).backgroundImage
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
      },
      [SHEET_PATH.source, pseudo] as const
    )

for (const { prefix, text } of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix
  const home = text.stops.home
  const meishi = text.stops.meishi
  const lab = text.stops.lab
  const monument = text.stops.monument
  const robot = text.stops.robot
  const campfire = text.stops.campfire
  const mailbox = text.stops.mailbox
  const journey = text.stops.journey

  // 完走は 8 か所の会話と次へを、その言語の文言のまま最後までつなぐ。ja の完走は村の統合テスト
  // (src/components/VillagePage/container.browser.test.tsx)が見る。統合のフィクスチャは ja の props だけを渡すので、
  // ko の全部の地点の文言で次へを連ねるのはこの検査だけで、ko だけを E2E に残す
  // (docs/decisions/0015-trim-e2e-overlap-and-ko.md・docs/decisions/0018-move-e2e-and-gate-all-hooks.md)
  if (prefix === '') continue

  test(`夜で雨でも8か所のコースは最後まで通る (${label})`, async ({ page }) => {
    // 10s 待ちを7回連ねるので既定の30sを超える
    test.setTimeout(90_000)
    await stubWeather(page, 'rain')
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
    // 自動の移動(飛んで扉を出る)で町(屋外)へ出た最初の地点。ここから完走まで雨が降り続けるはず
    await expect(page.locator(RAIN_LAYERS), '町へ出た時点で雨が降っている').toHaveCount(
      WEATHER_LAYER_COUNT
    )
    await dialog.getByRole('button', { name: meishi.next }).click()
    await expect(dialog.getByRole('heading', { name: lab.title })).toBeVisible({ timeout: 10_000 })
    // 研究所 → 経歴碑 → AIロボ → 焚き火 → ポスト → 次の旅を次へで連ねる。
    // 最後の次の旅は、北の道の突き当たり(arrivalArea)へ着いたことで会話窓が自動で開く
    const chain = [lab, monument, robot, campfire, mailbox]
    for (const [i, stop] of chain.entries()) {
      const next = chain[i + 1] ?? journey
      await dialog.getByRole('button', { name: stop.next }).click()
      await expect(dialog.getByRole('heading', { name: next.title })).toBeVisible({
        timeout: 10_000,
      })
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText(
      text.allSeen.replace('{list}', text.toList)
    )
    // 完走すると一覧への出口へ焦点が移り、出口が跳ねて(data-bounce)合図する
    const exit = page.locator('[data-village-exit]')
    await expect(exit).toBeFocused()
    await expect(exit).toHaveAttribute('data-bounce', '')
    // 完走しても段階と雨はそのまま(コースの進行が空や天気を壊していない)。
    // 2 枚のうち片方でも落ちていればコマ送りが壊れているので、ここも枚数まで見る
    await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', 'night')
    await expect(page.locator(RAIN_LAYERS), '完走後も雨が降り続けている').toHaveCount(
      WEATHER_LAYER_COUNT
    )
  })
}

// 段階ごとの焼いたシートは、ビルドが焼く /sprites/ の PNG とローダーが差し込むスプライトの背景が要り、
// 統合テストでは描かれないので E2E に残す(段階の属性 data-phase は統合テストも見る)。言語では変わらないので ja だけで見る
for (const { prefix } of JOURNEYS) {
  const label = prefix === '' ? '/' : prefix
  if (prefix !== '') continue

  // 明け方・夕方は data-phase の属性だけを見ていた頃、昼のシートを使い回すよう戻しても
  // 素通りしていた。4段階ぶんの指紋を集めて総当たりで突き合わせ、どの2段階が同じになっても落とす
  test(`4段階のどれも属性だけでなく焼いたシートそのものが入れ替わる (${label})`, async ({
    page,
  }) => {
    // 4段階ぶん村を開き直すので既定の30秒では足りない
    test.setTimeout(60_000)

    const grounds = new Map<DayPhase, string>()
    const players = new Map<DayPhase, string>()
    for (const phase of DAY_PHASES) {
      await page.clock.setFixedTime(new Date(PHASE_CLOCKS[phase]))
      await openVillage(page, prefix)
      await expect(page.locator(VILLAGE_ROOT)).toHaveAttribute('data-phase', phase)
      const ground = await sheetDigest(page, GROUND_SPRITE)
      const player = await sheetDigest(page, '[data-village-player]', '::before')
      expect(ground.sheet, `${phase} の地形シートがサイト内の焼いたシートPNGである`).toBe(true)
      expect(player.sheet, `${phase} の主人公シートがサイト内の焼いたシートPNGである`).toBe(true)
      grounds.set(phase, ground.digest)
      players.set(phase, player.digest)
    }

    // 属性が変わっただけでなく、要素へ解決される背景画像そのものが段階ごとに別物になっている。
    // 総当たりで見るのは、落ちたときにどの2段階が同じシートなのかをそのまま読めるようにするため
    for (const [index, phase] of DAY_PHASES.entries()) {
      for (const other of DAY_PHASES.slice(index + 1)) {
        expect(grounds.get(other), `地形シートが ${phase} と ${other} で違う`).not.toBe(
          grounds.get(phase)
        )
        expect(players.get(other), `主人公シートが ${phase} と ${other} で違う`).not.toBe(
          players.get(phase)
        )
      }
    }
  })
}
