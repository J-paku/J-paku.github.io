// 「AIが作った感(AI tell)」を機械判定するスクリプト。
// portfolio-hub-spec/07-redesign.md §4 の14ルール + DIRECTION-FINAL.md §3 追加分を実装する。
// check-a11y.mjs と同じ構造(Playwright + 経路巡回 + 非零終了コードゲート)を踏襲する。
//
// FAIL = 終了コード非零(仕様書がFAILと明記したものだけ)。
// WARN = 出力のみで終了コードに影響しない(誤検知リスクが仕様書に明記されたルール:
//        #5 線形スタガー等差数列、#7 カード左ストライプ)。
// SKIP = 現状のプロジェクトに対象が存在しないため判定を見送る(#12 アイコンライブラリ)。
//
// #1 border-radius種類数の上限は DIRECTION.md §4-1 で3種(2/4/6px)に確定済みのため、
// 1種のみ(唯一の値)だけでなく4種以上もFAILにする(WARNからFAILへ格上げ、DIRECTION-FINAL.md §3-3)。
// #15(本文行間)・#16(均等カード横並び限定)は DIRECTION-FINAL.md §3-1・§3-2 で新設された判定式。
//
// データソースは2種類:
//   - computed style: Playwright で経路を開き page.evaluate() で取得
//   - ビルドCSS: dist/assets/*.css を文字列として読み込み正規表現で対照
//
// 使い方: node scripts/check-ai-tells.mjs <baseUrl> [path...]
// path省略時は既定6経路(/, /ko, /works/seatmap-demo, /works/ai-harness,
// /ko/works/seatmap-demo, /ko/works/ai-harness)を使う。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

// 08段階でケーススタディ詳細ルートを廃したため、巡回先は2経路だけになった。
// 消したルートを残すとNotFoundを検査して通ってしまい、検査したつもりの空振りになる
const DEFAULT_PATHS = ['/', '/ko']

const [, , baseUrl, ...cliPaths] = process.argv

if (!baseUrl) {
  console.error('使い方: node scripts/check-ai-tells.mjs <baseUrl> [path...]')
  process.exit(1)
}

// cliPaths が実際に渡されたときだけ既定値を上書きする(引数を無視するバグの再発防止)
const targetPaths = cliPaths.length > 0 ? cliPaths : DEFAULT_PATHS

// ===== 共通ユーティリティ =====

function walkFiles(dir, predicate, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, acc)
    } else if (predicate(fullPath)) {
      acc.push(fullPath)
    }
  }
  return acc
}

function loadDistCss() {
  const assetsDir = path.join(ROOT_DIR, 'dist/assets')
  const cssFiles = walkFiles(assetsDir, (file) => file.endsWith('.css'))
  if (cssFiles.length === 0) {
    console.error('[ERROR] dist/assets に CSS が見つからない。先に `npm run build` を実行すること。')
    process.exit(1)
  }
  return cssFiles.map((file) => readFileSync(file, 'utf-8')).join('\n')
}

// linear/radial/conic-gradient(...) を括弧深度カウンタで抽出する。
// 単純な split(',') は rgba(0,0,0,.5) 内部のコンマまで割ってしまうため使わない(仕様書 §4 注記)
function extractGradientFunctions(cssText) {
  const results = []
  const startPattern = /(linear|radial|conic)-gradient\(/gi
  let match = startPattern.exec(cssText)
  while (match !== null) {
    const type = match[1].toLowerCase()
    let depth = 1
    let i = startPattern.lastIndex
    const argsStart = i
    while (i < cssText.length && depth > 0) {
      if (cssText[i] === '(') depth += 1
      else if (cssText[i] === ')') depth -= 1
      i += 1
    }
    const argsStr = cssText.slice(argsStart, i - 1)
    results.push({ type, args: splitTopLevelArgs(argsStr) })
    startPattern.lastIndex = i
    match = startPattern.exec(cssText)
  }
  return results
}

// 括弧深度0のコンマだけで引数を分割する
function splitTopLevelArgs(argsStr) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of argsStr) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim() !== '') parts.push(current.trim())
  return parts
}

const results = []

function report(id, title, status, detail, gating) {
  results.push({ id, title, status, detail, gating })
  console.log(`[${status}] #${id} ${title}: ${detail}`)
}

// ===== ルール3: グラデーション color-stop 数(ビルドCSS) =====

const DIRECTION_KEYWORD_PATTERN =
  /^(to\s+(top|bottom|left|right)(\s+(top|bottom|left|right))?|-?[\d.]+(deg|grad|rad|turn))$/i

function evaluateGradientRule(cssText) {
  const gradients = extractGradientFunctions(cssText)
  const offenders = gradients.filter((g) => {
    if (g.type !== 'linear' || g.args.length === 0) return false
    const hasDirection = DIRECTION_KEYWORD_PATTERN.test(g.args[0])
    if (!hasDirection) return false
    const stopCount = g.args.length - 1
    return stopCount === 2
  })

  if (offenders.length > 0) {
    const example = offenders[0]
    report(
      3,
      'グラデーションcolor-stop数',
      'FAIL',
      `方向文法+2stopのlinear-gradientが${offenders.length}件(例: ${example.args.join(', ')})`,
      true,
    )
  } else {
    report(3, 'グラデーションcolor-stop数', 'PASS', `linear-gradient検出${gradients.length}件、2stop方向違反0件`, true)
  }
}

// ===== ルール4: transition:all(ビルドCSS) =====

function evaluateTransitionAllRule(cssText) {
  const matches = [
    ...cssText.matchAll(/transition\s*:\s*all\b/gi),
    ...cssText.matchAll(/transition-property\s*:\s*all\b/gi),
  ]
  if (matches.length > 0) {
    report(4, 'transition:all使用', 'FAIL', `${matches.length}件検出`, true)
  } else {
    report(4, 'transition:all使用', 'PASS', '0件検出', true)
  }
}

// ===== ルール5: 線形スタガー遅延(ビルドCSS・WARN専用) =====

// ビルドの CSS 最小化で `100ms`→`.1s`、`:nth-child(1)`→`:first-child` に書き換わるため
// (03-pitfalls.md #1 と同種の「自動最適化と手動判定の食い違い」)、両方の形を拾ってms換算する
function toMilliseconds(value, unit) {
  const num = Number(value)
  return unit.toLowerCase() === 's' ? num * 1000 : num
}

function evaluateStaggerRule(cssText) {
  const entries = []
  const nthPattern =
    /nth-child\(\s*(\d+)\s*\)[^{}]*\{[^{}]*?(?:animation-delay|transition-delay)\s*:\s*([\d.]+)(ms|s)\b/gi
  for (const m of cssText.matchAll(nthPattern)) {
    entries.push({ index: Number(m[1]), delay: toMilliseconds(m[2], m[3]) })
  }
  const firstChildPattern =
    /:first-child[^{}]*\{[^{}]*?(?:animation-delay|transition-delay)\s*:\s*([\d.]+)(ms|s)\b/gi
  for (const m of cssText.matchAll(firstChildPattern)) {
    entries.push({ index: 1, delay: toMilliseconds(m[1], m[2]) })
  }
  entries.sort((a, b) => a.index - b.index)

  let runLength = 1
  let commonDiff = null
  let bestRun = null

  for (let i = 1; i < entries.length; i += 1) {
    const diff = entries[i].delay - entries[i - 1].delay
    if (diff === commonDiff) {
      runLength += 1
    } else {
      commonDiff = diff
      runLength = 2
    }
    if (runLength >= 3 && commonDiff > 0 && commonDiff % 100 === 0) {
      bestRun = { commonDiff, runLength, delays: entries.slice(i - runLength + 1, i + 1).map((e) => e.delay) }
    }
  }

  if (bestRun !== null) {
    report(
      5,
      '線形スタガー遅延',
      'WARN',
      `公差${bestRun.commonDiff}msの等差数列を${bestRun.runLength}件連続検出(${bestRun.delays.join('/')}ms)。誤検知の可能性があるためディレクター目視確認が必要`,
      false,
    )
  } else {
    report(5, '線形スタガー遅延', 'PASS', `nth-child遅延${entries.length}件のうち100ms倍数の等差数列なし`, false)
  }
}

// ===== ルール8: 均等3〜4分割グリッド(ビルドCSS) =====

function hasAsymmetricFr(value) {
  const frTokens = [...value.matchAll(/(\d+)fr/g)].map((m) => Number(m[1]))
  if (frTokens.length < 2) return false
  return new Set(frTokens).size >= 2
}

function evaluateGridRule(cssText) {
  const values = [...cssText.matchAll(/grid-template-columns\s*:\s*([^;}]+)/gi)].map((m) => m[1].trim())
  const uniformPattern = /repeat\(\s*[34]\s*,\s*1fr\s*\)/i
  const explicitEqualPattern = /^(1fr\s+){2,3}1fr$/i
  const uniformMatches = values.filter((v) => uniformPattern.test(v) || explicitEqualPattern.test(v))
  const asymmetricFound = values.some(hasAsymmetricFr)

  if (uniformMatches.length > 0) {
    report(8, '均等3〜4分割グリッド', 'FAIL', `均等グリッドを${uniformMatches.length}件検出(例: ${uniformMatches[0]})`, true)
  } else {
    report(8, '均等3〜4分割グリッド', 'PASS', `grid-template-columns${values.length}件のうち均等3〜4分割0件`, true)
  }
  // 必須6(非対称比率が最低1箇所)の欠如は「fr係数の異同」というヒューリスティックに依存し誤検知余地があるため、
  // ゲートには含めず参考出力のみに留める(#1上限超過・#5・#7と同種の誤検知リスク)
  console.log(
    `  参考: 非対称fr比率(例 2fr 1fr) ${asymmetricFound ? '検出あり' : '未検出'}(必須6参照、ゲート対象外)`,
  )
}

// ===== ルール11: ::selection / :focus-visible カスタマイズ(ビルドCSS) =====

function evaluateSelectionFocusRule(cssText) {
  const selectionMatch = cssText.match(/::selection\s*\{([^}]*)\}/i)
  const focusVisibleMatch = cssText.match(/:focus-visible\s*\{([^}]*)\}/i)
  const selectionOk = selectionMatch !== null && /background|color/i.test(selectionMatch[1])
  const focusVisibleOk =
    focusVisibleMatch !== null &&
    /outline|background|color|box-shadow/i.test(focusVisibleMatch[1]) &&
    !/outline\s*:\s*auto\b/i.test(focusVisibleMatch[1])

  const missing = []
  if (!selectionOk) missing.push('::selection')
  if (!focusVisibleOk) missing.push(':focus-visible')

  if (missing.length > 0) {
    report(11, '::selection/:focus-visibleカスタマイズ', 'FAIL', `未カスタマイズ: ${missing.join(', ')}`, true)
  } else {
    report(11, '::selection/:focus-visibleカスタマイズ', 'PASS', '両方カスタマイズ済み', true)
  }
}

// ===== ルール12: アイコンライブラリ無修正使用(package.json・条件分岐) =====

const KNOWN_ICON_PACKAGES = [
  'lucide-react',
  'react-icons',
  '@heroicons/react',
  'phosphor-react',
  '@phosphor-icons/react',
  'react-feather',
  '@tabler/icons-react',
]

function evaluateIconLibraryRule() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const detected = KNOWN_ICON_PACKAGES.filter((name) => name in deps)

  if (detected.length === 0) {
    report(12, 'アイコンライブラリ無修正使用', 'SKIP', 'package.jsonにアイコンパッケージ未検出のため対象外', false)
  } else {
    // 「無修正で使っているか」はコードの意図判断が必要で機械的に決定不能なため WARN に留める
    report(
      12,
      'アイコンライブラリ無修正使用',
      'WARN',
      `検出: ${detected.join(', ')}。無修正使用かどうかはディレクター目視確認が必要`,
      false,
    )
  }
}

// ===== ルール13: フォント単独使用(tokens.css ソース) =====

const CJK_FAMILY_KEYWORDS = [
  'Hiragino',
  'Gothic',
  'Noto Sans',
  'Malgun',
  'Apple SD',
  'Meiryo',
  'PingFang',
  'Batang',
  'Dotum',
  'Gulim',
  'Microsoft YaHei',
]

function evaluateFontStackRule() {
  const tokensSource = readFileSync(path.join(ROOT_DIR, 'src/styles/tokens.css'), 'utf-8')
  const targets = ['--f-display', '--f-body']
  const offenders = []
  const details = []

  for (const name of targets) {
    const match = tokensSource.match(new RegExp(`${name}\\s*:\\s*([^;]+);`, 'i'))
    if (match === null) {
      offenders.push(`${name}(未定義)`)
      continue
    }
    const families = match[1].split(',').map((s) => s.trim())
    const hasCjkFallback = families.slice(1).some((family) => CJK_FAMILY_KEYWORDS.some((kw) => family.includes(kw)))
    details.push(`${name}=${families.length}種`)
    if (!hasCjkFallback) offenders.push(name)
  }

  if (offenders.length > 0) {
    report(13, 'フォント単独使用', 'FAIL', `CJK代替が無い: ${offenders.join(', ')}`, true)
  } else {
    report(13, 'フォント単独使用', 'PASS', `CJK代替あり(${details.join(', ')})`, true)
  }
}

// ===== ルール9・10: 上投げ文言・スパークル絵文字(content/JSXソース) =====

const POWER_WORD_PATTERNS = [
  /\bUnlock\b/i,
  /\bSeamless\b/i,
  /\bRevolutionize\b/i,
  /\bSupercharge\b/i,
  /\bLeverage\b/i,
  /Game-changer/i,
  /Get Started/i,
  /Trusted by/i,
  /Built with ❤/i,
]
const NOT_JUST_PATTERN = /not just .+ it'?s/i
const SPARKLE_PATTERN = /✨/

function collectContentTsFiles() {
  const files = []
  for (const locale of ['ja', 'ko']) {
    files.push(...walkFiles(path.join(ROOT_DIR, 'content', locale), (f) => f.endsWith('.ts')))
  }
  return files
}

function findPowerWordOffense(text) {
  for (const pattern of POWER_WORD_PATTERNS) {
    if (pattern.test(text)) return pattern.source
  }
  if (NOT_JUST_PATTERN.test(text)) return NOT_JUST_PATTERN.source
  return null
}

function evaluatePowerWordRule(contentFiles, pageTexts) {
  for (const file of contentFiles) {
    const text = readFileSync(file, 'utf-8')
    const offense = findPowerWordOffense(text)
    if (offense !== null) {
      report(9, 'パワーワード・常套句', 'FAIL', `${path.relative(ROOT_DIR, file)}に検出(${offense})`, true)
      return
    }
  }
  for (const { targetPath, innerText } of pageTexts) {
    const offense = findPowerWordOffense(innerText)
    if (offense !== null) {
      report(9, 'パワーワード・常套句', 'FAIL', `${targetPath}の描画テキストに検出(${offense})`, true)
      return
    }
  }
  report(9, 'パワーワード・常套句', 'PASS', `content ${contentFiles.length}件・描画${pageTexts.length}経路とも0件`, true)
}

function evaluateSparkleRule(contentFiles) {
  const srcFiles = walkFiles(path.join(ROOT_DIR, 'src'), (f) => f.endsWith('.tsx') || f.endsWith('.ts'))
  const allFiles = [...contentFiles, ...srcFiles]
  for (const file of allFiles) {
    const text = readFileSync(file, 'utf-8')
    if (SPARKLE_PATTERN.test(text)) {
      report(10, 'スパークル絵文字', 'FAIL', `${path.relative(ROOT_DIR, file)}に✨検出`, true)
      return
    }
  }
  report(10, 'スパークル絵文字', 'PASS', `content/JSX ${allFiles.length}件で✨検出0件`, true)
}

// ===== ルール1: border-radius種類数の上限(DIRECTION.md §4-1 で3種に確定) =====

// DIRECTION-FINAL.md §3-3: 07-redesign.md §4 ルール#1がDIRECTION.mdへ委ねた上限値は
// --radius-chip(2px) / --radius-control(4px) / --radius-surface(6px) の3種で確定済み。
// 4種以上ならWARNではなくFAILに格上げする。
const RADIUS_SPECIES_UPPER_BOUND = 3

// ===== Playwright 経由の computed style 収集 =====

async function auditPath(browser, targetPath) {
  const page = await browser.newPage()
  // スタガーリビールが opacity:0 から始まるため、モーションを止めないと computed style が
  // リビール途中の値になる(check-a11y.mjs と同じ理由)
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const url = new URL(targetPath, baseUrl).toString()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => {
    const root = document.querySelector('#root')
    return root !== null && root.childElementCount > 0
  })

  const data = await page.evaluate(() => {
    function isVisible(el) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      const style = window.getComputedStyle(el)
      return style.visibility !== 'hidden' && style.display !== 'none'
    }

    const borderRadii = new Set()
    const fontWeights = new Set()
    let stickyBackdropHeader = false
    const cardStripeCandidates = []

    for (const el of document.querySelectorAll('*')) {
      if (!isVisible(el)) continue
      const style = window.getComputedStyle(el)

      const radius = style.borderRadius
      if (radius && !/^(0px\s*)+$/.test(radius)) {
        borderRadii.add(radius)
      }

      if (el.children.length === 0 && el.textContent.trim() !== '') {
        fontWeights.add(style.fontWeight)
      }

      if (el.tagName === 'HEADER') {
        const position = style.position
        const backdrop = style.backdropFilter
        if ((position === 'sticky' || position === 'fixed') && backdrop !== 'none' && backdrop !== '') {
          stickyBackdropHeader = true
        }
      }

      if (el.tagName === 'ARTICLE') {
        const leftWidth = parseFloat(style.borderLeftWidth)
        const topWidth = parseFloat(style.borderTopWidth)
        const rightWidth = parseFloat(style.borderRightWidth)
        const bottomWidth = parseFloat(style.borderBottomWidth)
        const isStripe =
          leftWidth >= 3 &&
          leftWidth <= 4 &&
          topWidth === 0 &&
          rightWidth === 0 &&
          bottomWidth === 0 &&
          style.borderLeftColor !== 'rgba(0, 0, 0, 0)' &&
          style.borderLeftColor !== 'transparent'
        if (isStripe) cardStripeCandidates.push(style.borderLeftColor)
      }
    }

    // 最上位(他のsectionの子孫でない) section 要素だけを対象にする(Home/WorkDetail共通)
    const sectionElements = [...document.querySelectorAll('section')].filter((el) => {
      let parent = el.parentElement
      while (parent !== null) {
        if (parent.tagName === 'SECTION') return false
        parent = parent.parentElement
      }
      return true
    })
    const sectionPaddings = sectionElements.map((el) => {
      const style = window.getComputedStyle(el)
      return {
        id: el.id || null,
        paddingBlockStart: style.paddingBlockStart,
        paddingBlockEnd: style.paddingBlockEnd,
      }
    })

    // ルール15(N4) — 本文行間。サイズではなく「実際に2行以上レンダされたか」で判定する
    // (DIRECTION-FINAL.md §3-1)。boundingRect.height / lineHeight で行数を数えてはいけない —
    // padding(kbdチップ)とgridアイテムの既定 align-self:stretch(meta__label)を行数と誤認する。
    // Range.getClientRects() の「異なるtopの個数」なら両方に影響されない。
    const lineHeightViolations = []
    for (const el of document.querySelectorAll('body *')) {
      // 自分で直接テキストを持つ要素だけ(子要素だけで構成されたコンテナは除外)
      const hasOwnText = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0,
      )
      if (!hasOwnText) continue

      const cs = window.getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue

      const fontSize = parseFloat(cs.fontSize)
      const lineHeight = parseFloat(cs.lineHeight)
      if (!Number.isFinite(fontSize) || !Number.isFinite(lineHeight)) continue

      // 除外1: 見出し階層。DIRECTION §0-4 が 1.25 / 1.4 を実測で確定している
      if (fontSize >= 24) continue

      // 除外2: 1行しか描画されていない要素。行間は行が変わるときにだけ存在する
      const range = document.createRange()
      range.selectNodeContents(el)
      const tops = new Set(
        [...range.getClientRects()]
          .filter((r) => r.width > 0 || r.height > 0)
          .map((r) => Math.round(r.top)),
      )
      if (tops.size < 2) continue

      const ratio = lineHeight / fontSize
      if (ratio < 1.5) {
        lineHeightViolations.push({
          tag: el.tagName,
          cls: el.className,
          fontSize,
          lineHeight,
          ratio: Number(ratio.toFixed(3)),
          lines: tops.size,
          text: el.textContent.trim().slice(0, 30),
        })
      }
    }

    // ルール16(N6) — 均等カード検査に「横に並んでいる」条件を加える(DIRECTION-FINAL.md §3-2)。
    // 上下に積まれた全幅セクションは幅が当然同じになるため、条件1(同じ段)で除外する。
    // 背景に敷く装飾の縦罫線(1px)は等幅・横並び・背景ありを全て満たすがカードではないため、条件4で除外する
    const CARD_MIN_WIDTH = 4
    const uniformSiblingViolations = []
    for (const parent of document.querySelectorAll('body *')) {
      const kids = [...parent.children].filter((el) => {
        const cs = window.getComputedStyle(el)
        return cs.display !== 'none' && cs.visibility !== 'hidden'
      })
      if (kids.length < 3) continue

      const boxes = kids.map((el) => ({ el, r: el.getBoundingClientRect(), cs: window.getComputedStyle(el) }))

      // 条件1: 全員の上辺が4px以内に揃っている(= 同じ段に並んでいる)
      const tops = boxes.map((b) => b.r.top)
      if (Math.max(...tops) - Math.min(...tops) > 4) continue

      // 条件2: x範囲が互いに重ならない(= 縦積みではなく横並び)
      const sorted = [...boxes].sort((a, b) => a.r.left - b.r.left)
      const overlaps = sorted.some((b, i) => i > 0 && b.r.left < sorted[i - 1].r.right - 1)
      if (overlaps) continue

      // 条件3: 幅が互いに±2px以内
      const widths = boxes.map((b) => b.r.width)
      if (Math.max(...widths) - Math.min(...widths) > 2) continue

      // 条件4: 全員がカードと呼べる幅を持つ(背景に敷く1pxの装飾罫線を外す)
      if (widths.some((w) => w < CARD_MIN_WIDTH)) continue

      // 条件5: 全員が箱として描かれている(borderかbackgroundを持つ)
      const boxed = boxes.every((b) => {
        const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(
          (s) =>
            parseFloat(b.cs[`border${s}Width`]) > 0 &&
            b.cs[`border${s}Style`] !== 'none' &&
            !/rgba\(.*,\s*0\)$/.test(b.cs[`border${s}Color`]),
        )
        const bg = b.cs.backgroundColor
        const hasBg = bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)
        return hasBorder || hasBg
      })
      if (!boxed) continue

      uniformSiblingViolations.push({
        parent: parent.tagName + (parent.className ? '.' + parent.className : ''),
        count: kids.length,
      })
    }

    return {
      borderRadii: [...borderRadii],
      fontWeights: [...fontWeights],
      stickyBackdropHeader,
      cardStripeCandidates,
      sectionPaddings,
      lineHeightViolations,
      uniformSiblingViolations,
      innerText: document.body.innerText,
    }
  })

  await page.close()
  return { targetPath, ...data }
}

// 「全セクションが同値」ではなく「3箇所以上が同値のグループが存在するか」を見る。
// Hero だけ値が違っても残りの一般セクション群が全部揃っていれば禁止7(メトロノームリズム)に該当するため、
// ページ内の最大同値グループの大きさで判定する
function evaluateSectionPaddingRule(pageResults) {
  const offendingPaths = []
  for (const { targetPath, sectionPaddings } of pageResults) {
    if (sectionPaddings.length < 3) continue
    const counts = new Map()
    for (const s of sectionPaddings) {
      const key = `${s.paddingBlockStart}/${s.paddingBlockEnd}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    let maxValue = null
    let maxCount = 0
    for (const [value, count] of counts) {
      if (count > maxCount) {
        maxValue = value
        maxCount = count
      }
    }
    if (maxCount >= 3) {
      offendingPaths.push({ targetPath, total: sectionPaddings.length, count: maxCount, value: maxValue })
    }
  }

  if (offendingPaths.length > 0) {
    const example = offendingPaths[0]
    report(
      2,
      'セクションpadding-block同一性',
      'FAIL',
      `${offendingPaths.length}経路で同値セクションが3個以上(例: ${example.targetPath}は${example.total}個中${example.count}個が${example.value})`,
      true,
    )
  } else {
    report(2, 'セクションpadding-block同一性', 'PASS', '3箇所以上が同値のセクション群なし', true)
  }
}

function evaluateBorderRadiusRule(pageResults) {
  const allRadii = new Set()
  for (const { borderRadii } of pageResults) {
    for (const r of borderRadii) allRadii.add(r)
  }
  if (allRadii.size === 1) {
    report(1, 'border-radius種類数', 'FAIL', `唯一の値のみ検出(${[...allRadii][0]})`, true)
  } else if (allRadii.size > RADIUS_SPECIES_UPPER_BOUND) {
    report(
      1,
      'border-radius種類数',
      'FAIL',
      `上限${RADIUS_SPECIES_UPPER_BOUND}種を超過(実測${allRadii.size}種: ${[...allRadii].join(', ')})`,
      true,
    )
  } else {
    report(1, 'border-radius種類数', 'PASS', `${allRadii.size}種検出(${[...allRadii].join(', ')})`, true)
  }
}

function evaluateFontWeightRule(pageResults) {
  const allWeights = new Set()
  for (const { fontWeights } of pageResults) {
    for (const w of fontWeights) allWeights.add(w)
  }
  if (allWeights.size < 3) {
    report(14, 'ウェイト位階', 'FAIL', `${allWeights.size}種のみ(${[...allWeights].join(', ')})`, true)
  } else {
    report(14, 'ウェイト位階', 'PASS', `${allWeights.size}種検出(${[...allWeights].join(', ')})`, true)
  }
}

function evaluateStickyBackdropRule(pageResults) {
  const offenders = pageResults.filter((r) => r.stickyBackdropHeader)
  if (offenders.length > 0) {
    report(6, 'backdrop-blurスティッキーナビ', 'FAIL', `${offenders.length}経路でsticky/fixed+backdrop-filter検出`, true)
  } else {
    report(6, 'backdrop-blurスティッキーナビ', 'PASS', '該当ヘッダーなし', true)
  }
}

function evaluateCardStripeRule(pageResults) {
  const allCandidates = pageResults.flatMap((r) => r.cardStripeCandidates)
  if (allCandidates.length > 0) {
    report(
      7,
      'カード左カラーストライプ',
      'WARN',
      `article要素で${allCandidates.length}件検出(色例: ${allCandidates[0]})。ヒューリスティックのためスクリーンショット確認が必要`,
      false,
    )
  } else {
    report(7, 'カード左カラーストライプ', 'PASS', 'article要素で左ストライプ候補0件', false)
  }
}

// ===== ルール15(N4): 本文行間 — 実際に2行以上レンダされた要素だけを対象にする =====
// DIRECTION-FINAL.md §3-1。サイズによる除外(18px以下限定・24px以上除外)はどちらも不完全で、
// 15px `--fs-ui` + `--lh-ui:1.3` が2行になる違反(密UIの行間を折り返し要素に流用)を見逃す。
// 「実際に折り返されたか」で判定すればサイズによらずこの違反も拾える。
function evaluateLineHeightRule(pageResults) {
  const allViolations = pageResults.flatMap((r) =>
    r.lineHeightViolations.map((v) => ({ ...v, targetPath: r.targetPath })),
  )
  if (allViolations.length > 0) {
    const example = allViolations[0]
    const cls = example.cls || '(no class)'
    report(
      15,
      '本文行間(折り返し要素限定)',
      'FAIL',
      `${allViolations.length}件検出(例: ${example.targetPath} ${example.tag}.${cls} ` +
        `${example.fontSize}px/lh${example.lineHeight}=${example.ratio} ${example.lines}行 「${example.text}」)`,
      true,
    )
  } else {
    report(15, '本文行間(折り返し要素限定)', 'PASS', '2行以上レンダされた要素で行間比1.5未満は0件', true)
  }
}

// ===== ルール16(N6): 均等カード — 横並びの兄弟だけを対象にする =====
// DIRECTION-FINAL.md §3-2。旧判定式は「横に並んでいること」が条件に無く、上下に積まれた
// 全幅セクション(幅が当然同一)まで誤検出していた。同じ段(top差4px以内)かつx範囲が
// 重ならない(横並び)場合だけを対象に加える。
function evaluateUniformSiblingRule(pageResults) {
  const allViolations = pageResults.flatMap((r) =>
    r.uniformSiblingViolations.map((v) => ({ ...v, targetPath: r.targetPath })),
  )
  if (allViolations.length > 0) {
    const example = allViolations[0]
    report(
      16,
      '均等カード(横並び限定)',
      'FAIL',
      `${allViolations.length}件検出(例: ${example.targetPath} ${example.parent} 子要素${example.count}個)`,
      true,
    )
  } else {
    report(16, '均等カード(横並び限定)', 'PASS', '横並び・等幅・箱型を同時に満たす兄弟グループは0件', true)
  }
}

async function main() {
  const cssText = loadDistCss()

  console.log('== ビルドCSS/ソースベースのルール ==')
  evaluateGradientRule(cssText)
  evaluateTransitionAllRule(cssText)
  evaluateStaggerRule(cssText)
  evaluateGridRule(cssText)
  evaluateSelectionFocusRule(cssText)
  evaluateIconLibraryRule()
  evaluateFontStackRule()

  const contentFiles = collectContentTsFiles()
  evaluateSparkleRule(contentFiles)

  console.log('== Playwright computed style ベースのルール ==')
  const browser = await chromium.launch()
  const pageResults = []
  try {
    for (const targetPath of targetPaths) {
      pageResults.push(await auditPath(browser, targetPath))
    }
  } finally {
    await browser.close()
  }

  evaluateBorderRadiusRule(pageResults)
  evaluateSectionPaddingRule(pageResults)
  evaluateStickyBackdropRule(pageResults)
  evaluateCardStripeRule(pageResults)
  evaluateFontWeightRule(pageResults)
  evaluatePowerWordRule(contentFiles, pageResults)
  evaluateLineHeightRule(pageResults)
  evaluateUniformSiblingRule(pageResults)

  const failures = results.filter((r) => r.gating && r.status === 'FAIL')
  const warnings = results.filter((r) => r.status === 'WARN')

  console.log('')
  console.log(`AI tell検査: FAIL ${failures.length}件・WARN ${warnings.length}件(WARNは終了コードに影響しない)`)

  if (failures.length > 0) {
    console.error(`FAILしたルール: ${failures.map((r) => `#${r.id}`).join(', ')}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
