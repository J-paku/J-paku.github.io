// axe-core を Playwright 経由で注入して WCAG 適合性を検査するスクリプト。
// @axe-core/cli は selenium-webdriver + chromedriver 経由でクロムを起動するため
// GitHub Actions ランナーで頻繁に session not created で落ちる(05-pipeline.md)。
// Playwright が管理する Chromium を使い axe.min.js をページに直接注入する方式に置き換えている。
// 呼び出し方(引数・終了コード)は変更していない。
//
// 以前あった「Ctrl+Kでコマンドパレットを開いた状態の検査」(07-redesign.md §3-5)は、
// 08段階でパレット自体を削除したため対象が存在しなくなり除去した。
//
// 検査するのは「経路 × 見え方」+ 開いた状態。初期状態(PC・明るいテーマ)だけを測ると、
// 実機で一番使われる縦持ちの操作帯も、色が総入れ替えになるダークテーマも、会話窓を開いた
// 状態も一度も axe に掛からないまま「全経路で違反0件」になる。
// 状態の作り方は tests/journey.spec.ts(E で会話窓)と tests/layout.spec.ts(縦持ちの寸法)に合わせる。
//
// 「開かないまま検査した」は PASS 方向の誤りなので、状態を作れなかったこと自体も NG として数える
// (03-pitfalls.md #5・#7・#11)。
//
// 使い方: node scripts/check-a11y.mjs <baseUrl> <path> [path...]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expectedDisclosureIds } from './expected-disclosures.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

// WCAG 適合性のみをゲートにするタグ。best-practice は別集計にして終了コードに反映しない(05-pipeline.md の方針)
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const BEST_PRACTICE_TAG = 'best-practice'

const [, , baseUrl, ...targetPaths] = process.argv

if (!baseUrl || targetPaths.length === 0) {
  console.error('使い方: node scripts/check-a11y.mjs <baseUrl> <path> [path...]')
  process.exit(1)
}

const axeSource = readFileSync(path.join(ROOT_DIR, 'node_modules/axe-core/axe.min.js'), 'utf-8')

// 村は表示後に Open-Meteo へ大阪の天気を問い合わせる(src/lib/weather.ts)。実際の応答を待つと
// networkidle が外部 API の速さで伸び、結果も検査した時刻の天気で変わるので、応答を固定する。
// 雨にしておくのは、天気の層が描かれる状態(屋外)まで検査が広がった時に層も含めて測るため。
// 今測る村の初期状態は自室(屋内)なので、層そのものはまだ描かれない。
// 応答の形は src/lib/weather.ts の isOpenMeteoResponse に合わせる(tests/village.helpers.ts の rain と同じ値)。
// Google Fonts は差し替えない — 実際の書体で描いた画面を測るのがこの検査の前提
const OPEN_METEO = 'https://api.open-meteo.com/**'
const RAINING_BODY = JSON.stringify({ current: { precipitation: 2.4, snowfall: 0 } })

// テーマの保存先。src/lib/preferences.ts の THEME_STORAGE_KEY、および
// src/app/html-shell.tsx が起動時に読む文字列と同じ値を保つ
const THEME_STORAGE_KEY = 'theme'

// 検査する見え方。縦持ちの寸法と入力種別は tests/layout.spec.ts の「縦持ちのスマートフォン」と同じ。
// 縦持ちでしか描かれない操作帯(スティック・A/B)と、ダークテーマの配色は、既定の見え方の
// 結果からは何も分からないので別々に測る
const PORTRAIT_WIDTH = 390
const VIEWS = [
  { name: '既定', contextOptions: {}, theme: null },
  {
    name: `縦持ち${PORTRAIT_WIDTH}px`,
    contextOptions: {
      viewport: { width: PORTRAIT_WIDTH, height: 664 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    },
    theme: null,
    // 実際にこの幅で描かれたか。帯が見えることは幅が効いた証拠にならない
    // (1280px + hasTouch でも帯は出ると実測した)ので、幅そのものを見る
    expectedWidth: PORTRAIT_WIDTH,
    // 指のある環境でだけ見える操作帯。PC の見え方では DOM に在っても hidden
    // (tests/layout.spec.ts の PC のテストが toBeHidden で押さえている前提)。
    // 村の経路でこれが見えていなければ、スティックと A/B を一度も axe に掛けていない
    villageOnlyVisible: '[data-village-controls]',
  },
  { name: 'ダークテーマ', contextOptions: {}, theme: 'dark' },
]

// 村の経路(会話窓を開ける)。末尾スラッシュの有無は経路の同一性に関係しない
const VILLAGE_PATHS = ['', '/ko']
const normalizePath = targetPath => targetPath.replace(/\/+$/, '')
const isVillagePath = targetPath => VILLAGE_PATHS.includes(normalizePath(targetPath))

// 折りたたみ(作品カードの詳細)が必ず在る経路。ここで0件なら検査が成立していない。
// 村の経路には折りたたみが無いのが正常なので、断言はしない。
//
// 対象を一覧に絞るのは実測に基づく: 作品ページの button[aria-controls] は技術チップの
// ポップオーバーで1ページ16件あり、全経路で開いて回ると axe の実行回数が跳ね上がる。
// 一覧の詳細は「開かないと本文が hidden」という、元の経歴パネルと同じ性質の対象
const DISCLOSURE_PATHS = ['/list', '/ko/list']
const hasDisclosures = targetPath => DISCLOSURE_PATHS.includes(normalizePath(targetPath))

// WCAG 違反とは別に、「検査が成立しなかった」事実を数える。
// 状態を作れなかった回を黙って通すと、測っていないことが違反0件に化ける
const setupFailures = []
const failSetup = message => {
  console.error(`[NG] ${message}`)
  setupFailures.push(message)
}

// 現在のページに対して axe を1回実行し、WCAG 違反と best-practice 違反に分けて返す
async function runAxe(page) {
  const result = await page.evaluate(
    async ({ wcagTags, bestPracticeTag }) =>
      window.axe.run(document, {
        runOnly: { type: 'tag', values: [...wcagTags, bestPracticeTag] },
      }),
    { wcagTags: WCAG_TAGS, bestPracticeTag: BEST_PRACTICE_TAG }
  )

  const wcagViolations = result.violations.filter(violation =>
    violation.tags.some(tag => WCAG_TAGS.includes(tag))
  )
  const bestPracticeViolations = result.violations.filter(
    violation => !violation.tags.some(tag => WCAG_TAGS.includes(tag))
  )

  return { wcagViolations, bestPracticeViolations }
}

// 1つの見え方でページを開き、axe を注入した page を返す。context は呼び出し側が閉じる。
// 見え方(縦持ち・テーマ)は context ごとに作る — 同じ page の viewport を差し替えるだけでは
// isMobile/hasTouch が変わらず、操作帯が出ない画面を「縦持ちで検査した」と呼ぶことになる
async function openView(browser, targetPath, view) {
  const context = await browser.newContext(view.contextOptions)
  await context.route(OPEN_METEO, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: RAINING_BODY })
  )
  const page = await context.newPage()
  // Home のスタガーリビールが opacity:0 から始まるため、モーションを止めた状態で計測しないと
  // 合成色で color-contrast が誤検出される(実測45〜51件 → 0件。05-pipeline.md)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (view.theme !== null) {
    // html-shell.tsx の起動スクリプトが localStorage から読む。最初の描画より前に書いておけば
    // 1枚目のペイントからそのテーマになり、切り替え途中の合成色を測らずに済む
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [THEME_STORAGE_KEY, view.theme]
    )
  }

  const url = new URL(targetPath, baseUrl).toString()
  const response = await page.goto(url, { waitUntil: 'networkidle' })
  // 消えた経路を検査対象に残すと 404 ページを検査して通ってしまう(03-pitfalls.md #11)。
  // 静的配信は存在しない経路に 404 を返すので、応答コードで先に落とす
  if (response === null || !response.ok()) {
    throw new Error(`${targetPath}: HTTP ${response?.status() ?? '(応答なし)'} — 経路が存在しない`)
  }
  // 静的エクスポートは本文が HTML に入っているのでマウント待ちは不要。
  // 村ページだけはブートの覆い(#boot)が外れるまで待つ。覆いの下を検査すると隠れた状態を測ることになる
  await page.waitForFunction(() => document.querySelector('#boot') === null)

  if (view.theme !== null) {
    // 指定したテーマが実際に当たっているかを見る。当たっていなければ測ったのは明るい画面であり、
    // 「ダークでも違反0件」の根拠にならない(保存キーが変わった時にここで気づく)
    const applied = await page.evaluate(() => document.documentElement.dataset.theme)
    if (applied !== view.theme) {
      failSetup(
        `${targetPath} (${view.name}): data-theme が "${applied}" のまま。テーマの状態を作れていない`
      )
    }
  }

  if (view.expectedWidth !== undefined) {
    const actualWidth = await page.evaluate(() => window.innerWidth)
    if (actualWidth !== view.expectedWidth) {
      failSetup(
        `${targetPath} (${view.name}): 実際の幅が ${actualWidth}px。` +
          `${view.expectedWidth}px の見え方を作れていない`
      )
    }
  }

  if (view.villageOnlyVisible !== undefined && isVillagePath(targetPath)) {
    const visible = await page.locator(view.villageOnlyVisible).isVisible()
    if (!visible) {
      failSetup(
        `${targetPath} (${view.name}): ${view.villageOnlyVisible} が見えない。` +
          'その見え方を作れていない'
      )
    }
  }

  await page.addScriptTag({ content: axeSource })
  return { context, page }
}

// 折りたたみを1つずつ開いた状態を検査する。開閉対象は初期状態で hidden のため、
// 開かないまま検査すると中の本文が一度も検査対象に入らず、そこに潜む違反が PASS 方向に見えてしまう
// (03-pitfalls.md #5・#7 と同型)。
//
// トグルは id を名指しせず「button[aria-controls]」という形で集める。
// 個別の id(かつて panel-career、今なら ai-harness-detail)を書くと、作品が入れ替わった日に
// 一致するものが無くなり、検査は落ちずに空回りしたまま [OK] を出し続ける(03-pitfalls.md #11)
//
// 見え方ごと(既定・縦持ち・ダーク)に開く。詳細の本文は開かないと hidden なので、既定でしか
// 開かないと「ダークテーマでだけ薄い本文色」のような違反が一度も axe に掛からない
async function auditDisclosures(page, targetPath, viewLabel) {
  const triggers = await page.$$('button[aria-controls]')
  // 畳まれた中にいるトグルは押せない。見えているものだけを対象にする
  const visibleTriggers = []
  for (const trigger of triggers) {
    if (await trigger.isVisible()) visibleTriggers.push(trigger)
  }

  const reports = []
  const openedIds = new Set()
  for (const [index, trigger] of visibleTriggers.entries()) {
    const controls = await trigger.getAttribute('aria-controls')
    // 既に開いているものを押すと畳んでしまう。閉じている時だけ押す
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
    try {
      // 押した本人が開いたと言い、指している要素が実際に見えるまで待つ。
      // 状態が確定する前に axe を走らせると、色の半端なスナップショットで color-contrast を誤検出する
      await page.waitForFunction(el => el.getAttribute('aria-expanded') === 'true', trigger, {
        timeout: 5_000,
      })
      await page.waitForSelector(`[id="${controls}"]`, { state: 'visible', timeout: 5_000 })
    } catch {
      failSetup(`${viewLabel}: トグル${index + 1}(aria-controls="${controls}")を押しても開かない`)
      continue
    }
    openedIds.add(controls)
    // 開いた後もスタイル再計算・ペイントが同フレームに乗り切らない場合があるため、2フレーム待って確定させる
    await page.evaluate(
      () =>
        new Promise(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        })
    )
    reports.push({
      label: `${viewLabel} (開閉${index + 1}: ${controls})`,
      ...(await runAxe(page)),
    })
  }

  // 床を「1件以上」にすると、2件のうち1件が消えても中を検査しないまま通る。
  // 詳細を持つ作品を content から数え、その全部を開けたことを断言する(expected-disclosures.mjs)
  if (hasDisclosures(targetPath)) {
    const expectedIds = expectedDisclosureIds(targetPath)
    if (expectedIds.length === 0) {
      failSetup(`${viewLabel}: content に詳細を持つ作品が0件。開閉トグルの期待値を数えられていない`)
    }
    const missingIds = expectedIds.filter(id => !openedIds.has(id))
    if (missingIds.length > 0) {
      failSetup(
        `${viewLabel}: 開閉トグルを${openedIds.size}/${expectedIds.length}件しか開けていない` +
          `(未検査: ${missingIds.join(', ')})。中身を検査していない詳細がある`
      )
    }
  }
  return reports
}

// 村の会話窓(role=dialog)を開いた状態を検査する。開き方は tests/journey.spec.ts と同じで、
// 村の枠へフォーカスして E を押す(操作帯の A ボタンも同じ会話を開く)。
// 会話窓は aria-modal で背景を隠す作りなので、開かないまま測ると中の見出し・本文・
// 送りボタンが一度も axe に掛からない
async function auditVillageDialog(page, targetPath) {
  await page.locator('[data-village]').focus()
  await page.keyboard.press('e')
  try {
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 10_000 })
  } catch {
    failSetup(
      `${targetPath}: E を押しても会話窓(role=dialog)が開かない。開いた状態を検査できていない`
    )
    return []
  }
  // 開いた直後は本文の送りとフォーカス移動が同フレームに乗り切らないことがあるため、2フレーム待つ
  await page.evaluate(
    () =>
      new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })
  )
  return [{ label: `${targetPath} (会話窓)`, ...(await runAxe(page)) }]
}

// 1経路ぶんの axe 実行結果を返す。見え方(既定・縦持ち・ダーク)ごとに開き直し、
// 折りたたみは見え方ごとに開いて検査する。村の会話窓は既定の見え方でだけ開く
async function auditPath(browser, targetPath) {
  const reports = []
  for (const view of VIEWS) {
    const { context, page } = await openView(browser, targetPath, view)
    try {
      const label = view.name === '既定' ? targetPath : `${targetPath} (${view.name})`
      reports.push({ label, ...(await runAxe(page)) })

      // 折りたたみの中は本文の色・幅が見え方ごとに変わるので、見え方ごとに開く。
      // 一覧2経路 × 詳細の件数 × 3 見え方ぶん axe が増える(実測は下の件数表示を参照)
      if (hasDisclosures(targetPath)) {
        reports.push(...(await auditDisclosures(page, targetPath, label)))
      }
      // 会話窓は既定の見え方で1回だけ。見え方の数だけ開き直すと、同じ本文を
      // 何度も測るために実行時間だけが伸びる
      if (view.name === '既定') {
        if (isVillagePath(targetPath)) {
          reports.push(...(await auditVillageDialog(page, targetPath)))
        }
      }
    } finally {
      await context.close()
    }
  }
  return reports
}

function printViolation(violation) {
  const firstTarget = violation.nodes[0]?.target.join(' ') ?? '(不明)'
  console.error(
    `  - ${violation.id} [${violation.impact}] 対象${violation.nodes.length}件 例: ${firstTarget}`
  )

  // CI でしか再現しない色系フレークの原因特定用に、判定に使われた実色を残す
  if (violation.id === 'color-contrast') {
    for (const node of violation.nodes) {
      const data = node.any[0]?.data
      if (data) {
        console.error(`    fg=${data.fgColor} bg=${data.bgColor} ratio=${data.contrastRatio}`)
      }
    }
  }
}

async function main() {
  const browser = await chromium.launch()
  const reports = []

  try {
    for (const targetPath of targetPaths) {
      reports.push(...(await auditPath(browser, targetPath)))
    }
  } finally {
    await browser.close()
  }

  let totalWcagViolations = 0

  for (const { label, wcagViolations, bestPracticeViolations } of reports) {
    totalWcagViolations += wcagViolations.length

    if (wcagViolations.length === 0) {
      console.log(
        `[OK] ${label}: WCAG違反 0件(best-practice違反 ${bestPracticeViolations.length}件・参考のみ)`
      )
    } else {
      console.error(`[NG] ${label}: WCAG違反 ${wcagViolations.length}件`)
      wcagViolations.forEach(printViolation)
    }
  }

  console.log(`axe: ${targetPaths.length}経路を ${reports.length}状態で検査`)

  if (totalWcagViolations > 0) {
    console.error(`axe: WCAG違反が合計${totalWcagViolations}件見つかった`)
  }
  if (setupFailures.length > 0) {
    // 検査が成立しなかった回。違反0件と並べて緑にすると、測っていないことが通過に化ける
    console.error(`axe: 状態を作れず検査できなかった箇所が${setupFailures.length}件`)
    for (const message of setupFailures) console.error(`  - ${message}`)
  }
  if (totalWcagViolations > 0 || setupFailures.length > 0) process.exit(1)

  console.log('axe: 全経路・全状態でWCAG違反 0件')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
