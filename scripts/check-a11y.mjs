// axe-core を Playwright 経由で注入して WCAG 適合性を検査するスクリプト。
// @axe-core/cli は selenium-webdriver + chromedriver 経由でクロムを起動するため
// GitHub Actions ランナーで頻繁に session not created で落ちる(05-pipeline.md)。
// Playwright が管理する Chromium を使い axe.min.js をページに直接注入する方式に置き換えている。
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

// 1経路ぶんの axe 実行結果を WCAG 違反と best-practice 違反に分けて返す
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
  const result = await page.evaluate(
    async ({ wcagTags, bestPracticeTag }) =>
      window.axe.run(document, { runOnly: { type: 'tag', values: [...wcagTags, bestPracticeTag] } }),
    { wcagTags: WCAG_TAGS, bestPracticeTag: BEST_PRACTICE_TAG },
  )
  await page.close()

  const wcagViolations = result.violations.filter((violation) =>
    violation.tags.some((tag) => WCAG_TAGS.includes(tag)),
  )
  const bestPracticeViolations = result.violations.filter(
    (violation) => !violation.tags.some((tag) => WCAG_TAGS.includes(tag)),
  )

  return { targetPath, wcagViolations, bestPracticeViolations }
}

function printViolation(violation) {
  const firstTarget = violation.nodes[0]?.target.join(' ') ?? '(不明)'
  console.error(`  - ${violation.id} [${violation.impact}] 対象${violation.nodes.length}件 例: ${firstTarget}`)
}

async function main() {
  const browser = await chromium.launch()
  const reports = []

  try {
    for (const targetPath of targetPaths) {
      reports.push(await auditPath(browser, targetPath))
    }
  } finally {
    await browser.close()
  }

  let totalWcagViolations = 0

  for (const { targetPath, wcagViolations, bestPracticeViolations } of reports) {
    totalWcagViolations += wcagViolations.length

    if (wcagViolations.length === 0) {
      console.log(`[OK] ${targetPath}: WCAG違反 0件(best-practice違反 ${bestPracticeViolations.length}件・参考のみ)`)
    } else {
      console.error(`[NG] ${targetPath}: WCAG違反 ${wcagViolations.length}件`)
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
