// 日本語(と韓国語)の改行位置を実測する検査スクリプト。
//
// 何を確かめるか:
//   1. 適用値   — body に word-break: keep-all / overflow-wrap: break-word / line-break: strict が
//                 実際に効いているか。CSSの特異度負けで一部だけ適用される事故を防ぐため、
//                 「見た目の症状」ではなく computed 値そのものを見る(03-pitfalls.md #6)
//   2. 改行位置 — 各行の切れ目が「許された位置」に一致するか。許されるのは <wbr>(文節境界)と
//                 空白の直後、そして要素境界だけ。それ以外で切れていれば文節の途中で切れている
//   3. 禁則     — 行頭に句読点・閉じ括弧・小書き仮名・長音符が来ていないか。行末に開き括弧が
//                 来ていないか
//   4. 孤立行   — 2行以上ある段落の最終行が1〜2文字だけになっていないか(報告のみ、既定では落とさない)
//
// 使い方: node scripts/check-ja-linebreak.mjs <baseUrl> [--verbose] [path...]
import { execSync } from 'node:child_process'
import { chromium } from 'playwright'

const argv = process.argv.slice(2)
const isVerbose = argv.includes('--verbose')
const positional = argv.filter((arg) => !arg.startsWith('--'))
const [baseUrl, ...argPaths] = positional

if (baseUrl === undefined) {
  console.error('使い方: node scripts/check-ja-linebreak.mjs <baseUrl> [--verbose] [path...]')
  process.exit(1)
}

// 経路はラウタが持つ2件だけ。消えた経路を残すと #root が生成されず検査が途中で止まる(03-pitfalls.md #11)
const DEFAULT_PATHS = ['/', '/ko']
const targetPaths = argPaths.length > 0 ? argPaths : DEFAULT_PATHS

// 実機で使われる代表的な論理幅。iPhone SE(320) から Pro Max(430) まで
const WIDTHS = [320, 360, 375, 390, 414, 430]

// フォントが無いと全角文字が .notdef へ落ち、実際より狭い幅で測られて改行が起きなくなる。
// 「改行が無い」は PASS 方向の誤りなので、測定前に必ず止める(03-pitfalls.md #5)
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
    `check-ja-linebreak: CJKフォントが見つからない(ja=${jaFontCount}件, ko=${koFontCount}件)。` +
      '幅測定が偽ってPASSになるため中止する(03-pitfalls.md #5)',
  )
  process.exit(1)
}
console.log(`check-ja-linebreak: CJKフォント確認 OK (ja=${jaFontCount}件, ko=${koFontCount}件)`)

const EXPECTED_STYLE = {
  wordBreak: 'keep-all',
  overflowWrap: 'break-word',
  lineBreak: 'strict',
}

async function measurePage(page) {
  return page.evaluate(() => {
    // 行頭に来てはいけない文字(終わり括弧・句読点・小書き仮名・長音符・中黒)
    const FORBIDDEN_LINE_START =
      '、。，．・：；？！゛゜ヽヾゝゞ々ー’”)〕]｝〉》」』】〙〗〟｠»' +
      'ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ' +
      '。、．，)]｝、〉》」』】’”'
    // 行末に来てはいけない文字(始まり括弧)
    const FORBIDDEN_LINE_END = '‘“(〔[｛〈《「『【〘〖〝｟«'

    // 直下のテキストノードだけを対象にする。子要素(バッジ等)は別の行箱なのでここでは測らない。
    // 子要素と <wbr> の位置は「切れてよい場所」として記録する
    const collect = (element) => {
      const chars = []
      const allowedBreaks = new Set()
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.nodeValue ?? ''
          for (let index = 0; index < text.length; index += 1) {
            chars.push({ node, offset: index, char: text[index] })
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // <wbr> も他の要素も、そこで行が変わるのは正当
          allowedBreaks.add(chars.length)
        }
      }
      // 空白の直後も正当な切れ目(空白自体は行末で潰れる)
      for (let index = 0; index < chars.length; index += 1) {
        if (/\s/.test(chars[index].char)) {
          allowedBreaks.add(index)
          allowedBreaks.add(index + 1)
        }
      }
      return { chars, allowedBreaks }
    }

    const results = []
    for (const element of document.querySelectorAll('body *')) {
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') continue

      const { chars, allowedBreaks } = collect(element)
      const visible = chars.filter((entry) => !/\s/.test(entry.char))
      if (visible.length < 4) continue

      // 1文字ずつ矩形を取り、top が変わったところが改行位置
      const range = document.createRange()
      const lines = []
      let previousTop = null
      for (let index = 0; index < chars.length; index += 1) {
        const entry = chars[index]
        range.setStart(entry.node, entry.offset)
        range.setEnd(entry.node, entry.offset + 1)
        const rect = range.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        const top = Math.round(rect.top * 2) / 2
        if (previousTop === null || Math.abs(top - previousTop) > 0.6) {
          lines.push({ startIndex: index, text: '' })
          previousTop = top
        }
        lines[lines.length - 1].text += entry.char
      }
      if (lines.length === 0) continue

      const selector = `${element.tagName.toLowerCase()}${
        typeof element.className === 'string' && element.className.trim() !== ''
          ? `.${element.className.trim().split(/\s+/).join('.')}`
          : ''
      }`

      // 「文節の途中で切れた」の判定。
      // keep-all は文字どうしの改行だけを止めるもので、句読点・括弧・ハイフンの前後に
      // UAX #14 が定める改行機会はそのまま残る。そこで切れるのは日本語として自然なので、
      // 前後の両方が文字(かな・漢字・ラテン・数字)である切れ目だけを違反とする。
      // ここを「<wbr> 以外は全部違反」にすると、正常な組版まで NG になって検査が使えなくなる
      const isLetter = (char) => char !== undefined && /[\p{L}\p{N}]/u.test(char)

      // 切れ目を含む文節の綴りを取り出す。境界は allowedBreaks(=<wbr>・要素・空白)
      const boundaries = [0, ...[...allowedBreaks].sort((a, b) => a - b), chars.length]
      const chunkAround = (position) => {
        let start = 0
        let end = chars.length
        for (const boundary of boundaries) {
          if (boundary <= position) start = boundary
          if (boundary > position) { end = boundary; break }
        }
        return chars.slice(start, end).map((entry) => entry.char).join('')
      }

      // word-break: normal は「狭い幅では文節組版だと行末が凸凹になる」ため意図的に離脱した
      // オプトアウト(work-detail.module.css 等の @media (max-width: 767px) 参照)。
      // その要素では語の途中で切れること自体が想定内の挙動になるため、文節途中の判定は丸ごと
      // スキップする。禁則・孤立行・body の適用値チェックはこの分岐の外なので影響を受けない
      const badBreaks = []
      const forcedBreaks = []
      if (style.wordBreak !== 'normal') {
        // 枠より長い語は、どこかで折るしか手が無い。文節幅と要素の内容幅を実測して切り分ける
        const elementStyle = window.getComputedStyle(element)
        const contentWidth =
          element.getBoundingClientRect().width -
          parseFloat(elementStyle.paddingLeft) -
          parseFloat(elementStyle.paddingRight)
        const ruler = document.createElement('span')
        ruler.style.cssText = 'position:absolute;white-space:pre;visibility:hidden;top:-9999px;left:-9999px'
        // font 一括指定は line-height などが絡むと空文字になることがあり、
        // その場合ルーラーが既定書体(16px)で測ってしまい文節幅を大幅に過小評価する(実測)。
        // 個別プロパティで写す
        for (const property of [
          'fontFamily',
          'fontSize',
          'fontWeight',
          'fontStyle',
          'fontStretch',
          'fontFeatureSettings',
          'letterSpacing',
          'textTransform',
        ]) {
          ruler.style[property] = elementStyle[property]
        }
        document.body.appendChild(ruler)
        const widthOf = (text) => {
          ruler.textContent = text
          return ruler.getBoundingClientRect().width
        }

        for (let index = 1; index < lines.length; index += 1) {
          const startIndex = lines[index].startIndex
          if (allowedBreaks.has(startIndex)) continue
          const before = lines[index - 1].text[lines[index - 1].text.length - 1]
          const after = lines[index].text[0]
          if (!isLetter(before) || !isLetter(after)) continue

          const chunk = chunkAround(startIndex - 1)
          const label = `…${lines[index - 1].text.slice(-4)} / ${lines[index].text.slice(0, 4)}…`
          if (widthOf(chunk) > contentWidth) {
            forcedBreaks.push(`${label} (語幅${Math.round(widthOf(chunk))}px > 枠${Math.round(contentWidth)}px)`)
          } else {
            badBreaks.push(label)
          }
        }
        ruler.remove()
      }

      const kinsokuStart = []
      const kinsokuEnd = []
      for (let index = 0; index < lines.length; index += 1) {
        const text = lines[index].text
        if (index > 0 && FORBIDDEN_LINE_START.includes(text[0])) {
          kinsokuStart.push(`行${index + 1}頭 "${text.slice(0, 4)}…"`)
        }
        if (index < lines.length - 1 && FORBIDDEN_LINE_END.includes(text[text.length - 1])) {
          kinsokuEnd.push(`行${index + 1}末 "…${text.slice(-4)}"`)
        }
      }

      const lastLine = lines[lines.length - 1].text.trim()
      const isOrphan = lines.length >= 2 && lastLine.length > 0 && lastLine.length <= 2

      results.push({
        selector,
        lines: lines.map((line) => line.text),
        badBreaks,
        kinsokuStart,
        kinsokuEnd,
        isOrphan,
        lastLine,
        forcedBreaks,
      })
    }

    const bodyStyle = window.getComputedStyle(document.body)
    return {
      style: {
        wordBreak: bodyStyle.wordBreak,
        overflowWrap: bodyStyle.overflowWrap,
        lineBreak: bodyStyle.lineBreak,
      },
      results,
    }
  })
}

async function main() {
  const browser = await chromium.launch()
  let failures = 0
  let orphanCount = 0
  let forcedCount = 0
  let measuredElements = 0

  // 1状態(初期状態、または経歴トリガーを1つ開いた状態)ぶんの計測結果を集計へ足しこむ。
  // panel-career は初期状態で hidden のため、開かないまま計測すると中の本文の改行が
  // 一度も測定対象に入らず、そこに潜む違反が PASS 方向に見えてしまう(03-pitfalls.md #5・#7 と同型)
  function recordMeasurement(label, { style, results }) {
    for (const [property, expected] of Object.entries(EXPECTED_STYLE)) {
      if (style[property] !== expected) {
        failures += 1
        console.error(`[NG] ${label}: body の ${property} が "${style[property]}"、期待は "${expected}"`)
      }
    }

    for (const result of results) {
      measuredElements += 1
      if (result.badBreaks.length > 0) {
        failures += 1
        console.error(`[NG] ${label} ${result.selector}: 文節の途中で改行`)
        for (const bad of result.badBreaks) console.error(`       ${bad}`)
      }
      if (result.kinsokuStart.length > 0 || result.kinsokuEnd.length > 0) {
        failures += 1
        console.error(`[NG] ${label} ${result.selector}: 禁則違反`)
        for (const item of [...result.kinsokuStart, ...result.kinsokuEnd]) {
          console.error(`       ${item}`)
        }
      }
      if (result.forcedBreaks.length > 0) {
        forcedCount += result.forcedBreaks.length
        console.warn(`[不可避] ${label} ${result.selector}: 枠より長い語のため語中で改行`)
        for (const forced of result.forcedBreaks) console.warn(`       ${forced}`)
      }
      if (result.isOrphan) {
        orphanCount += 1
        console.warn(`[孤立] ${label} ${result.selector}: 最終行が "${result.lastLine}" のみ`)
      }
      if (isVerbose && result.lines.length > 1) {
        console.log(`  ${label} ${result.selector}`)
        for (const line of result.lines) console.log(`      | ${line}`)
      }
    }
  }

  try {
    for (const targetPath of targetPaths) {
      for (const width of WIDTHS) {
        // 幅を変えるたびに context を作り直す(=ページを開き直す)ので、経歴トグルの
        // 開閉状態はここで確実に初期化される
        const context = await browser.newContext({ viewport: { width, height: 900 } })
        const page = await context.newPage()
        const url = new URL(targetPath, baseUrl).toString()
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.waitForFunction(() => {
          const root = document.querySelector('#root')
          return root !== null && root.childElementCount > 0
        })
        // 配信CSSの書体が載り切るまで待つ。載る前に測ると代替書体の幅で測ってしまう
        await page.evaluate(() => document.fonts.ready)

        const label = `${targetPath} @${width}px`
        recordMeasurement(label, await measurePage(page))

        // 左列の経歴トリガーを1つずつ開き、その都度計測する。経歴どうしは排他
        // (1つ開くと前の状態は消える)なので、開いてから毎回そのまま計測すればよい。
        // トリガーが無い経路(作品ストーリーページ等)はループが空になり、従来どおり初期状態のみになる
        const careerTriggers = await page.$$('button[aria-controls="panel-career"]:not([role="tab"])')
        for (const [index, trigger] of careerTriggers.entries()) {
          await trigger.click()
          await page.waitForFunction(() => {
            const panel = document.querySelector('#panel-career')
            return panel !== null && !panel.hasAttribute('hidden')
          })
          recordMeasurement(`${targetPath} (経歴${index + 1}) @${width}px`, await measurePage(page))
        }

        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  console.log(
    `check-ja-linebreak: ${targetPaths.length}経路 × ${WIDTHS.length}幅、` +
      `延べ${measuredElements}要素を測定。不可避の語中改行 ${forcedCount}件 / 孤立行 ${orphanCount}件`,
  )

  if (failures > 0) {
    console.error(`check-ja-linebreak: NG ${failures}件`)
    process.exit(1)
  }
  console.log('check-ja-linebreak: 文節途中の改行・禁則違反ともに 0件')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
