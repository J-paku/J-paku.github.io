// axe-core を Playwright 経由で注入して WCAG 適合性を検査するスクリプト。
// @axe-core/cli は selenium-webdriver + chromedriver 経由でクロムを起動するため
// GitHub Actions ランナーで頻繁に session not created で落ちる(05-pipeline.md)。
// Playwright が管理する Chromium を使い axe.min.js をページに直接注入する方式に置き換えている。
// 呼び出し方(引数・終了コード)は変更していない。
//
// 以前あった「Ctrl+Kでコマンドパレットを開いた状態の検査」(07-redesign.md §3-5)は、
// 08段階でパレット自体を削除したため対象が存在しなくなり除去した。
//
// 使い方: node scripts/check-a11y.mjs <baseUrl> <path> [path...]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

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

// 現在のページに対して axe を1回実行し、WCAG 違反と best-practice 違反に分けて返す
async function runAxe(page) {
  const result = await page.evaluate(
    async ({ wcagTags, bestPracticeTag }) =>
      window.axe.run(document, { runOnly: { type: 'tag', values: [...wcagTags, bestPracticeTag] } }),
    { wcagTags: WCAG_TAGS, bestPracticeTag: BEST_PRACTICE_TAG },
  )

  const wcagViolations = result.violations.filter((violation) =>
    violation.tags.some((tag) => WCAG_TAGS.includes(tag)),
  )
  const bestPracticeViolations = result.violations.filter(
    (violation) => !violation.tags.some((tag) => WCAG_TAGS.includes(tag)),
  )

  return { wcagViolations, bestPracticeViolations }
}

// 1経路ぶんの axe 実行結果を返す。初期状態に加え、左列の経歴トリガーを1つずつ開いた
// 状態でも検査する。panel-career は初期状態で hidden のため、開かないまま検査すると
// 中の本文が一度も検査対象に入らず、そこに潜む違反が PASS 方向に見えてしまう
// (03-pitfalls.md #5・#7 と同型)。経歴トリガーが無い経路(作品ストーリーページ等)は
// 従来どおり初期状態のみを検査する
async function auditPath(browser, targetPath) {
  const page = await browser.newPage()
  // Home のスタガーリビールが opacity:0 から始まるため、モーションを止めた状態で計測しないと
  // 合成色で color-contrast が誤検出される(実測45〜51件 → 0件。05-pipeline.md)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const url = new URL(targetPath, baseUrl).toString()
  await page.goto(url, { waitUntil: 'networkidle' })
  // React のマウント完了を実測して待つ(固定スリープではなく #root の中身が入るまで待機)
  await page.waitForFunction(() => {
    const root = document.querySelector('#root')
    return root !== null && root.childElementCount > 0
  })

  await page.addScriptTag({ content: axeSource })

  const reports = [{ label: targetPath, ...(await runAxe(page)) }]

  // タブ(role=tab)は同じ panel-career を指すが別トリガーなので除外する。
  // 経歴どうしは排他(1つ開くと前の状態は消える)なので、開いてから毎回そのまま検査すればよい
  const careerTriggers = await page.$$('button[aria-controls="panel-career"]:not([role="tab"])')
  for (const [index, trigger] of careerTriggers.entries()) {
    await trigger.click()
    await page.waitForFunction(() => {
      const panel = document.querySelector('#panel-career')
      return panel !== null && !panel.hasAttribute('hidden')
    })
    // 2つ目以降はパネルが既に開いていて従来の条件が即真になり、React が aria-current を
    // 移す前に axe が走る(色の半端なスナップショットで color-contrast を誤検出)。
    // クリックした本人が current になるまで待って状態確定を保証する
    await page.waitForFunction((el) => el.getAttribute('aria-current') === 'true', trigger)
    // aria-current 反映後もスタイル再計算・ペイントが同フレームに乗り切らない場合があるため、2フレーム待って確定させる
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    }))
    reports.push({ label: `${targetPath} (経歴${index + 1})`, ...(await runAxe(page)) })
  }

  await page.close()

  return reports
}

function printViolation(violation) {
  const firstTarget = violation.nodes[0]?.target.join(' ') ?? '(不明)'
  console.error(`  - ${violation.id} [${violation.impact}] 対象${violation.nodes.length}件 例: ${firstTarget}`)

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
      console.log(`[OK] ${label}: WCAG違反 0件(best-practice違反 ${bestPracticeViolations.length}件・参考のみ)`)
    } else {
      console.error(`[NG] ${label}: WCAG違反 ${wcagViolations.length}件`)
      wcagViolations.forEach(printViolation)
    }
  }

  if (totalWcagViolations > 0) {
    console.error(`axe: WCAG違反が合計${totalWcagViolations}件見つかった`)
    process.exit(1)
  }

  console.log('axe: 全経路でWCAG違反 0件')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
