// 360×800ビューポートで横スクロールが発生していないかを検査するスクリプト。
// これまで各セッションが即席スクリプトで確認してきた検査を、コミット資産として昇格したもの
// (07-redesign.md §3-3、§6の危険8)。
//
// 判定: document.documentElement.scrollWidth <= window.innerWidth
// 超過している場合は「どの要素が犯人か」を、実際にビューポート幅を超えているDOM要素の
// セレクタ・実測幅とあわせて出力する。単に「超えた」とだけ言っても直せない
//
// 使い方: node scripts/check-viewport-overflow.mjs <baseUrl> [path...]
// pathを省略した場合、デプリンク確認(07-redesign.md §3-2)と同じ6経路を既定で検査する
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const [, , baseUrl, ...argPaths] = process.argv

if (!baseUrl) {
  console.error('使い方: node scripts/check-viewport-overflow.mjs <baseUrl> [path...]')
  process.exit(1)
}

// 公開作品2件(seatmap-demo・ai-harness) × 2ロケール + ルート2件 = 6経路(07-redesign.md §3-2の基準線と同一)
const DEFAULT_PATHS = [
  '/',
  '/ko',
  '/works/seatmap-demo',
  '/works/ai-harness',
  '/ko/works/seatmap-demo',
  '/ko/works/ai-harness',
]
const targetPaths = argPaths.length > 0 ? argPaths : DEFAULT_PATHS

const THEMES = ['light', 'dark']

// フォントが無いと全角文字が.notdefへフォールバックし、実際より狭い幅(0.6em相当)で
// 測定されてしまい、オーバーフロー判定が偽ってPASSする側へ倒れる(03-pitfalls.md #5 実測済み)。
// 測定前に必ずCJKフォントの存在を確認し、0件なら即座に非ゼロ終了する
function countFontsForLang(lang) {
  try {
    const output = execSync(`fc-list :lang=${lang}`, { encoding: 'utf-8' })
    return output.split('\n').filter((line) => line.trim() !== '').length
  } catch {
    return 0
  }
}

const jaFontCount = countFontsForLang('ja')
const koFontCount = countFontsForLang('ko')

if (jaFontCount === 0 || koFontCount === 0) {
  console.error(
    `check-viewport-overflow: CJKフォントが見つからない(ja=${jaFontCount}件, ko=${koFontCount}件)。` +
      '全角文字が.notdefへフォールバックし幅測定が偽ってPASSになるため中止する(03-pitfalls.md #5)',
  )
  process.exit(1)
}
console.log(`check-viewport-overflow: CJKフォント確認 OK (ja=${jaFontCount}件, ko=${koFontCount}件)`)

// ビューポート幅を超えているDOM要素を洗い出す。scrollWidthが超過している時だけ計算する
async function measureOverflow(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth
    const scrollWidth = document.documentElement.scrollWidth
    const overflow = scrollWidth > viewportWidth

    const culprits = []
    if (overflow) {
      for (const el of document.querySelectorAll('*')) {
        const rect = el.getBoundingClientRect()
        const exceeds = rect.right > viewportWidth + 1 || rect.width > viewportWidth + 1
        if (!exceeds) continue

        const tag = el.tagName.toLowerCase()
        const id = el.id ? `#${el.id}` : ''
        const classAttr = typeof el.className === 'string' ? el.className.trim() : ''
        const cls = classAttr === '' ? '' : `.${classAttr.split(/\s+/).join('.')}`

        culprits.push({
          selector: `${tag}${id}${cls}`,
          width: Math.round(rect.width),
          right: Math.round(rect.right),
        })
      }
      culprits.sort((a, b) => b.right - a.right)
    }

    return { viewportWidth, scrollWidth, overflow, culprits: culprits.slice(0, 5) }
  })
}

async function main() {
  const browser = await chromium.launch()
  let anyOverflow = false

  try {
    for (const targetPath of targetPaths) {
      for (const colorScheme of THEMES) {
        const context = await browser.newContext({ viewport: { width: 360, height: 800 }, colorScheme })
        const page = await context.newPage()

        const url = new URL(targetPath, baseUrl).toString()
        await page.goto(url, { waitUntil: 'networkidle' })
        // Reactのマウント完了を実測して待つ(固定スリープではなく#rootの中身が入るまで待機)
        await page.waitForFunction(() => {
          const root = document.querySelector('#root')
          return root !== null && root.childElementCount > 0
        })

        const info = await measureOverflow(page)
        await context.close()

        if (info.overflow) {
          anyOverflow = true
          console.error(
            `[NG] ${targetPath} (${colorScheme}): scrollWidth=${info.scrollWidth}px > innerWidth=${info.viewportWidth}px`,
          )
          for (const culprit of info.culprits) {
            console.error(`  - 犯人候補: ${culprit.selector} width=${culprit.width}px right=${culprit.right}px`)
          }
        } else {
          console.log(
            `[OK] ${targetPath} (${colorScheme}): scrollWidth=${info.scrollWidth}px <= innerWidth=${info.viewportWidth}px`,
          )
        }
      }
    }
  } finally {
    await browser.close()
  }

  if (anyOverflow) {
    console.error('check-viewport-overflow: 360px横スクロールが発生した経路がある')
    process.exit(1)
  }

  console.log('check-viewport-overflow: 全経路・light/darkとも横スクロール無し')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
