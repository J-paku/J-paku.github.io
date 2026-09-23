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
const positional = argv.filter(arg => !arg.startsWith('--'))
const [baseUrl, ...argPaths] = positional

if (baseUrl === undefined) {
  console.error('使い方: node scripts/check-ja-linebreak.mjs <baseUrl> [--verbose] [path...]')
  process.exit(1)
}

// 既定は村の2経路。消えた経路を残すと 404 ページを測ることになるので、応答コードで落とす(03-pitfalls.md #11)
const DEFAULT_PATHS = ['/', '/ko']
const targetPaths = argPaths.length > 0 ? argPaths : DEFAULT_PATHS

// 実機で使われる代表的な論理幅。iPhone SE(320) から Pro Max(430) まで
const WIDTHS = [320, 360, 375, 390, 414, 430]

// 折りたたみ(作品カードの詳細)が必ず在る経路。ここで0件なら検査が成立していない。
// 村や作品ページには一覧と同じ形の折りたたみが無いので、断言はしない
const DISCLOSURE_PATHS = ['/list', '/ko/list']
const hasDisclosures = targetPath => DISCLOSURE_PATHS.includes(targetPath.replace(/\/+$/, ''))

// 1 組(経路 × 幅)で測れていなければ「検査が成立していない」とみなす要素数の下限。
// verify-export.mjs が参照0件を exit 1 にしているのと同じ考え方で、測れなかったことを
// 「違反が無い」と読み替えないための床。
// 実測(2026-09-23、:4173 の out/):村 / と /ko/ が 9 要素、作品ページが 30 要素、
// 一覧は初期状態で 209〜224 要素(折りたたみを開いたぶんはさらに増える)。
// 一番少ない村でも半分近くまで減らないと踏まない 5 に置く
const MIN_ELEMENTS_PER_COMBO = 5

// 文節途中の判定をスキップした要素(word-break: normal)の割合の上限。
// オプトアウトは狭い幅(@media max-width: 767px)の長文段落だけに掛かっており
// (work-detail / story / scene-section / career-detail の各 module.css)、対象は限られる。
// 広いセレクタに normal が混ざって判定が丸ごと効かなくなると、違反は常に 0 件のまま緑になる。
// 実測(2026-09-23、同上)は 8574 要素中 2232 要素 = 26%。本文が増えても数%しか動かない一方、
// global.css など広い所へ normal が入れば 100% 近くまで跳ねるので、実測の倍を目安に 50% で切る
const MAX_SKIP_RATIO = 0.5

// 同時に開く組(経路 × 幅)の数。組ごとに context を作り直すので、組どうしは状態を共有しない。
// 1 組ずつ開くと 6 経路 × 6 幅の読み込み待ちが直列に積み上がる
const CONCURRENCY = 4

// 村は表示後に Open-Meteo へ大阪の天気を問い合わせる(src/lib/weather.ts)。実際の応答を待つと
// networkidle が外部 API の速さで伸びるので、降らない応答に固定する。
// 応答の形は src/lib/weather.ts の isOpenMeteoResponse に合わせる(tests/village.helpers.ts の clear と同じ値)。
// Google Fonts は差し替えない — 実際の書体の幅で改行位置を測るのがこの検査の前提
const OPEN_METEO = 'https://api.open-meteo.com/**'
const CLEAR_BODY = JSON.stringify({ current: { precipitation: 0, snowfall: 0 } })

// フォントが無いと全角文字が .notdef へ落ち、実際より狭い幅で測られて改行が起きなくなる。
// 「改行が無い」は PASS 方向の誤りなので、測定前に必ず止める(03-pitfalls.md #5)
function countFontsForLang(lang) {
  try {
    const output = execSync(`fc-list :lang=${lang}`, { encoding: 'utf-8' })
    return output.split('\n').filter(line => line.trim() !== '').length
  } catch {
    return 0
  }
}

const jaFontCount = countFontsForLang('ja')
const koFontCount = countFontsForLang('ko')

if (jaFontCount === 0 || koFontCount === 0) {
  console.error(
    `check-ja-linebreak: CJKフォントが見つからない(ja=${jaFontCount}件, ko=${koFontCount}件)。` +
      '幅測定が偽ってPASSになるため中止する(03-pitfalls.md #5)'
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
    const collect = element => {
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
      const visible = chars.filter(entry => !/\s/.test(entry.char))
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
      const isLetter = char => char !== undefined && /[\p{L}\p{N}]/u.test(char)

      // 切れ目を含む文節の綴りを取り出す。境界は allowedBreaks(=<wbr>・要素・空白)
      const boundaries = [0, ...[...allowedBreaks].sort((a, b) => a - b), chars.length]
      const chunkAround = position => {
        let start = 0
        let end = chars.length
        for (const boundary of boundaries) {
          if (boundary <= position) start = boundary
          if (boundary > position) {
            end = boundary
            break
          }
        }
        return chars
          .slice(start, end)
          .map(entry => entry.char)
          .join('')
      }

      // word-break: normal は「狭い幅では文節組版だと行末が凸凹になる」ため意図的に離脱した
      // オプトアウト(work-detail.module.css 等の @media (max-width: 767px) 参照)。
      // その要素では語の途中で切れること自体が想定内の挙動になるため、文節途中の判定は丸ごと
      // スキップする。禁則・孤立行・body の適用値チェックはこの分岐の外なので影響を受けない。
      //
      // スキップしたこと自体も呼び出し側へ返す。数えずに捨てると、広いセレクタへ
      // word-break: normal が混ざって判定が丸ごと効かなくなっても「違反0件」の緑で見える
      const wordBreakSkipped = style.wordBreak === 'normal'
      const badBreaks = []
      const forcedBreaks = []
      if (!wordBreakSkipped) {
        // 枠より長い語は、どこかで折るしか手が無い。文節幅と要素の内容幅を実測して切り分ける
        const elementStyle = window.getComputedStyle(element)
        const contentWidth =
          element.getBoundingClientRect().width -
          parseFloat(elementStyle.paddingLeft) -
          parseFloat(elementStyle.paddingRight)
        const ruler = document.createElement('span')
        ruler.style.cssText =
          'position:absolute;white-space:pre;visibility:hidden;top:-9999px;left:-9999px'
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
        const widthOf = text => {
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
            forcedBreaks.push(
              `${label} (語幅${Math.round(widthOf(chunk))}px > 枠${Math.round(contentWidth)}px)`
            )
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
        lines: lines.map(line => line.text),
        badBreaks,
        kinsokuStart,
        kinsokuEnd,
        isOrphan,
        lastLine,
        forcedBreaks,
        wordBreakSkipped,
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

// items を同時 limit 本までで task に通し、結果を items と同じ順で返す。
// 1 本でも失敗したら新しい仕事は取らず、最初の失敗を投げる
async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length)
  let nextIndex = 0
  let failed = false
  const runner = async () => {
    while (!failed && nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      try {
        results[index] = await task(items[index])
      } catch (error) {
        failed = true
        throw error
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner))
  return results
}

// 1 組(経路 × 幅)を開き、初期状態と折りたたみを 1 つずつ開いた状態を測って
// { targetPath, width, measurements, disclosureCount } で返す。
// measurements は { label, measurement } の列。
// 集計(recordMeasurement)は並列の外で組の順に行うので、出力の並びは 1 組ずつ測っていた頃と変わらない
async function measureCombo(browser, targetPath, width) {
  // 幅を変えるたびに context を作り直す(=ページを開き直す)ので、折りたたみの
  // 開閉状態はここで確実に初期化される
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  try {
    await context.route(OPEN_METEO, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: CLEAR_BODY })
    )
    const page = await context.newPage()
    const url = new URL(targetPath, baseUrl).toString()
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    // 消えた経路を検査対象に残すと 404 ページを測って通ってしまう(03-pitfalls.md #11)。
    // 静的配信は存在しない経路に 404 を返すので、応答コードで先に落とす
    if (response === null || !response.ok()) {
      throw new Error(
        `${targetPath}: HTTP ${response?.status() ?? '(応答なし)'} — 経路が存在しない`
      )
    }
    // 静的エクスポートは本文が HTML に入っているのでマウント待ちは不要。
    // 村ページだけはブートの覆い(#boot)が外れるまで待つ
    await page.waitForFunction(() => document.querySelector('#boot') === null)
    // 配信CSSの書体が載り切るまで待つ。載る前に測ると代替書体の幅で測ってしまう
    await page.evaluate(() => document.fonts.ready)

    const measurements = [
      { label: `${targetPath} @${width}px`, measurement: await measurePage(page) },
    ]

    // 一覧の折りたたみ(作品カードの詳細)を1つずつ開き、その都度計測する。
    // 開かないと中の本文は hidden のままで、そこの改行は一度も測られない。
    //
    // トグルは id を名指しせず「button[aria-controls]」という形で集める。個別の id
    // (かつて panel-career、今なら ai-harness-detail)を書くと、作品が入れ替わった日に
    // 一致するものが無くなり、検査は落ちずに空回りしたまま緑を出し続ける(03-pitfalls.md #11)
    let disclosureCount = 0
    if (hasDisclosures(targetPath)) {
      for (const trigger of await page.$$('button[aria-controls]')) {
        // 畳まれた中にいるトグルは押せない。見えているものだけを開く
        if (!(await trigger.isVisible())) continue
        const controls = await trigger.getAttribute('aria-controls')
        // 既に開いているものを押すと畳んでしまう。閉じている時だけ押す
        if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
        // 押した本人が開いたと言い、指している要素が実際に見えるまで待つ。
        // 開き切る前に測ると、確定していない幅で改行位置を読むことになる
        await page.waitForFunction(el => el.getAttribute('aria-expanded') === 'true', trigger)
        await page.waitForSelector(`[id="${controls}"]`, { state: 'visible' })
        disclosureCount += 1
        measurements.push({
          label: `${targetPath} (開閉${disclosureCount}) @${width}px`,
          measurement: await measurePage(page),
        })
      }
    }
    return { targetPath, width, measurements, disclosureCount }
  } finally {
    await context.close()
  }
}

async function main() {
  const browser = await chromium.launch()
  let failures = 0
  let orphanCount = 0
  let forcedCount = 0
  let measuredElements = 0
  let skippedElements = 0

  // 1状態(初期状態、または折りたたみを1つ開いた状態)ぶんの計測結果を集計へ足しこむ。
  // 折りたたみの中は初期状態で hidden のため、開かないまま計測すると中の本文の改行が
  // 一度も測定対象に入らず、そこに潜む違反が PASS 方向に見えてしまう(03-pitfalls.md #5・#7 と同型)
  function recordMeasurement(label, { style, results }) {
    for (const [property, expected] of Object.entries(EXPECTED_STYLE)) {
      if (style[property] !== expected) {
        failures += 1
        console.error(
          `[NG] ${label}: body の ${property} が "${style[property]}"、期待は "${expected}"`
        )
      }
    }

    for (const result of results) {
      measuredElements += 1
      if (result.wordBreakSkipped) skippedElements += 1
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

    // 組ごとの成立判定に使うので、この状態で数えた要素数を返す
    return results.length
  }

  try {
    const combos = targetPaths.flatMap(targetPath => WIDTHS.map(width => ({ targetPath, width })))
    const measured = await mapWithConcurrency(combos, CONCURRENCY, ({ targetPath, width }) =>
      measureCombo(browser, targetPath, width)
    )
    // 組ごとに数えるのは、経路が 404 に化けた・本文が描かれなかった回を「違反0件」で
    // 通さないため。合計だけを見ていると、よく測れた経路が空の経路を埋め合わせてしまう
    for (const { targetPath, width, measurements, disclosureCount } of measured) {
      let comboElements = 0
      for (const { label, measurement } of measurements) {
        comboElements += recordMeasurement(label, measurement)
      }
      // 折りたたみが0件のまま通ると、開いた中の改行を一度も測らずに「違反0件」になる
      if (hasDisclosures(targetPath) && disclosureCount === 0) {
        failures += 1
        console.error(
          `[NG] ${targetPath} @${width}px: 開閉トグル(button[aria-controls])が0件。` +
            '折りたたみの中を一度も測っていない'
        )
      }
      if (comboElements < MIN_ELEMENTS_PER_COMBO) {
        failures += 1
        console.error(
          `[NG] ${targetPath} @${width}px: 測定できた要素が${comboElements}件` +
            `(下限${MIN_ELEMENTS_PER_COMBO}件)。検査が成立していない`
        )
      }
    }
  } finally {
    await browser.close()
  }

  const skipRatio = measuredElements === 0 ? 0 : skippedElements / measuredElements
  console.log(
    `check-ja-linebreak: ${targetPaths.length}経路 × ${WIDTHS.length}幅、` +
      `測定 ${measuredElements}要素 / スキップ ${skippedElements}要素` +
      `(word-break: normal・${Math.round(skipRatio * 100)}%)。` +
      `不可避の語中改行 ${forcedCount}件 / 孤立行 ${orphanCount}件`
  )

  // 測定 0 件は「違反が無い」ではなく「検査できていない」(verify-export.mjs の参照0件と同型)
  if (measuredElements === 0) {
    failures += 1
    console.error('[NG] 測定できた要素が0件。検査が成立していない')
  }
  if (skipRatio > MAX_SKIP_RATIO) {
    failures += 1
    console.error(
      `[NG] 文節判定をスキップした要素が ${Math.round(skipRatio * 100)}%` +
        `(上限${Math.round(MAX_SKIP_RATIO * 100)}%)。word-break: normal が広く掛かっており、` +
        '違反0件は判定が効いていないだけの可能性がある'
    )
  }

  if (failures > 0) {
    console.error(`check-ja-linebreak: NG ${failures}件`)
    process.exit(1)
  }
  console.log('check-ja-linebreak: 文節途中の改行・禁則違反ともに 0件')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
