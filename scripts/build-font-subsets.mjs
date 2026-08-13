// 配信ページに実際に描画された文字だけを持つサブセットフォントを作り直す。
//
// なぜスクリプトにするか: サブセットを手で管理すると、コンテンツを1文字足しただけで
// フォント側が追いつかず、その文字だけシステムフォントへ落ちる(D5前の壊れ方の再来)。
// 「文字の集合はビルド済みページから機械的に採る」という形にして、人の記憶に依存させない。
//
// 手順:
//   1. npm run build
//   2. python3 -m http.server 8792 --directory dist
//   3. node scripts/build-font-subsets.mjs http://localhost:8792/ / /ko/
//   4. node scripts/check-glyph-coverage.mjs <同じURL> / /ko/   ← 被覆を機械確認
//
// dev サーバーに対しては走らせない。/mnt/c では HMR が取り消したコードを配り続けるため、
// 採った文字集合が今のソースと一致しているとは限らない(03-pitfalls #9)。
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const FONT_DIR = path.join(ROOT_DIR, 'public/fonts')
const MANIFEST = path.join(ROOT_DIR, 'scripts/subset-manifest.json')

// woff2 を返させるために新しめの Chrome を騙らせる。古いUAだと ttf が返る
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const [, , baseUrl, ...targetPaths] = process.argv

if (baseUrl === undefined || targetPaths.length === 0) {
  console.error('使い方: node scripts/build-font-subsets.mjs <baseUrl> <path> [path...]')
  process.exit(2)
}

// ラテン専用サブセット(Inter)は Google Fonts 配布の latin サブセットをそのまま使い続ける。
// 本文のラテンは技術名やURLで増減が激しく、文字単位で絞ると更新漏れの温床になる
const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'

const browser = await chromium.launch()

// 自己ホストする書体の family 名。チェーンの中でCJKを受け持つのはこの4つのどれか
const CJK_FAMILIES = ['Noto Serif JP', 'Noto Serif KR', 'Noto Sans JP', 'Noto Sans KR']
// ラテンも同じ書体で組む階層(見出しと名前)。ここだけラテンもサブセットへ入れる
const LATIN_OWNERS = ['Playfair Display', 'Noto Serif JP', 'Noto Serif KR']

// family + 太さ → ファイル名。400は接尾辞なし(既存ファイル名を変えないため)
const BASENAME = {
  'Playfair Display': 'playfair-display-name',
  'Noto Serif JP': 'noto-serif-jp-title',
  'Noto Serif KR': 'noto-serif-kr-title',
  'Noto Sans JP': 'noto-sans-jp-body',
  'Noto Sans KR': 'noto-sans-kr-body',
}

// 描画済みページから (family, 太さ) ごとの文字集合を採る。
// セレクタでは分類しない — 準備中バッジのように h3 の中に別書体・別太さの要素が入ると、
// セレクタ基準の分類が取りこぼす(実際に取りこぼして合成ボールドになっていた)。
// computed font-family のチェーンを見て「その文字を受け持つ自己ホスト書体」を決める
const buckets = {}
for (const targetPath of targetPaths) {
  const url = new URL(targetPath, baseUrl).href
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(600)

  // 設定メニュー(歯車)は閉じたままだと言語・テーマの選択肢文字列がDOMに無く採取から漏れる。
  // ボタンがあれば開いてパネルの描画を待ってから採取する
  const settingsButton = await page.$('button[aria-haspopup=true]')
  if (settingsButton !== null) {
    await settingsButton.click()
    await page.waitForTimeout(200)
  }

  const collected = await page.evaluate(
    ({ cjkFamilies, latinOwners }) => {
      const out = {}
      const add = (family, weight, char) => {
        const key = `${family}|${weight}`
        out[key] = (out[key] ?? '') + char
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const element = node.parentElement
        if (element === null) continue
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const families = style.fontFamily.split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        const weight = style.fontWeight
        const cjkFamily = families.find((family) => cjkFamilies.includes(family))
        const latinFamily = latinOwners.includes(families[0]) ? families[0] : undefined
        for (const char of node.textContent ?? '') {
          if (char.trim() === '') continue
          const code = char.codePointAt(0)
          if (code === undefined) continue
          if (code > 0x7f) {
            if (cjkFamily !== undefined) add(cjkFamily, weight, char)
          } else if (latinFamily !== undefined) {
            add(latinFamily, weight, char)
          }
        }
      }
      return out
    },
    { cjkFamilies: CJK_FAMILIES, latinOwners: LATIN_OWNERS },
  )
  for (const [key, chars] of Object.entries(collected)) {
    buckets[key] = (buckets[key] ?? '') + chars
  }
  console.log(`[採取] ${targetPath} — ${Object.keys(collected).length}系統`)
  await page.close()
}
await browser.close()

const jobs = Object.entries(buckets)
  .map(([key, chars]) => {
    const [family, weight] = key.split('|')
    const text = [...new Set(chars)].sort().join('')
    const base = BASENAME[family]
    return {
      file: weight === '400' ? base : `${base}-${weight}`,
      family,
      weight: Number(weight),
      // 太さ指定を付けると Google Fonts はその太さの実物を返す(合成ボールドを避ける)
      spec: weight === '400' ? family : `${family}:wght@${weight}`,
      text,
    }
  })
  .filter((job) => job.file !== undefined && job.text !== '')
  .sort((a, b) => a.file.localeCompare(b.file))

const expandRange = (range) => {
  const set = new Set()
  for (const part of range.split(',')) {
    const token = part.trim().replace(/^U\+/i, '')
    if (token.includes('-')) {
      const [from, to] = token.split('-').map((hex) => parseInt(hex, 16))
      for (let code = from; code <= to; code += 1) set.add(code)
    } else {
      set.add(parseInt(token, 16))
    }
  }
  return set
}

const manifest = {
  'inter-latin-var': {
    family: 'Inter',
    weight: '100 900',
    note: 'ラテン専用サブセット(Google Fonts 配布の latin をそのまま据え置き)',
    unicodeRange: LATIN_RANGE,
  },
}

let failed = 0
for (const job of jobs) {
  if (job.text === '') {
    console.error(`[FAIL] ${job.file}: 対象文字が0件。ページを採取できていない`)
    failed += 1
    continue
  }
  const css = execFileSync(
    'curl',
    ['-sS', '-A', UA, '--get', '--data-urlencode', `family=${job.spec}`, '--data-urlencode', `text=${job.text}`, 'https://fonts.googleapis.com/css2'],
    { encoding: 'utf8', maxBuffer: 8 << 20 },
  )
  const src = css.match(/url\(([^)]+)\)/)
  const range = css.match(/unicode-range:\s*([^;]+);/)
  if (src === null || range === null) {
    console.error(`[FAIL] ${job.file}: Google Fonts の応答を解釈できない`)
    failed += 1
    continue
  }
  execFileSync('curl', ['-sS', '-A', UA, '-o', path.join(FONT_DIR, `${job.file}.woff2`), src[1]])

  // 要求した文字が本当に入っているかをその場で確認する。範囲の項目数では判定しない
  const covered = expandRange(range[1])
  const missing = [...job.text].filter((char) => !covered.has(char.codePointAt(0)))
  const size = execFileSync('stat', ['-c', '%s', path.join(FONT_DIR, `${job.file}.woff2`)], { encoding: 'utf8' }).trim()
  if (missing.length > 0) {
    console.error(`[FAIL] ${job.file}: 要求したのに入っていない文字 ${missing.join('')}`)
    failed += 1
    continue
  }
  manifest[job.file] = { family: job.family, weight: job.weight, text: job.text, unicodeRange: range[1].trim() }
  console.log(`[OK] ${job.file.padEnd(26)} w${job.weight} ${String(size).padStart(6)}B  ${[...job.text].length}文字`)
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)

// fonts.css も同じ表から書き出す。手書きだと unicode-range が採取結果とずれ、
// 「サブセットには入っているのに CSS が拾わない」という一段厄介な壊れ方をする
const NOTES = {
  'inter-latin-var': '本文のラテン(--f-body の先頭)。日本語しかない行ではダウンロードされない',
  'playfair-display-name': '名前(J-Paku)専用。--f-display の先頭。ラテンだけの文字列なので1語の中で書体が割れない',
  'noto-serif-jp-title': '作品カード見出しの日本語セリフ(--f-title)。ラテンも同じ書体で組むため要求文字にラテンを含む',
  'noto-serif-kr-title': '作品カード見出しの韓国語セリフ(--f-title)。ja側と同じ設計',
  'noto-sans-jp-body': '本文・ラベルの日本語ゴシック(--f-body / --f-label / --f-mono の後段)',
  'noto-sans-jp-body-500': 'ラベルの日本語ゴシック500。合成ボールドを避けるため実物の太さを持つ',
  'noto-sans-jp-body-700': '経歴の組織名(.org)の日本語ゴシック700。同じ理由',
  'noto-sans-kr-body': '本文・ラベルの韓国語ゴシック。ja とはロケール別チェーンで分けている',
  'noto-sans-kr-body-500': 'ラベルの韓国語ゴシック500',
  'noto-sans-kr-body-700': '経歴の組織名(.org)の韓国語ゴシック700',
}
const wrapRange = (range) =>
  range
    .split(',')
    .map((item) => item.trim())
    .reduce((lines, item, index) => {
      if (index % 8 === 0) lines.push([])
      lines[lines.length - 1].push(item)
      return lines
    }, [])
    .map((line) => `    ${line.join(', ')}`)
    .join(',\n')

const header = `/*
 * このファイルは scripts/build-font-subsets.mjs が生成する。手で編集しない。
 *
 * 日本語・韓国語のフォントは「配信ページに実際に描画された文字」だけを持つサブセット。
 * D5より前は Playfair(ラテン専用)しか自己ホストしておらず、CJKは環境依存のゴシックへ
 * 落ちていた。そのため『AIエージェント開発環境』が AI だけセリフ・残りはゴシックという
 * 1語の中での書体交代を起こしていた(実測 A=16.0px/Playfair・座=26.0px/システム)。
 *
 * 文字が足りなくなるとその文字だけシステムフォントへ落ちるので、被覆は
 * scripts/check-glyph-coverage.mjs が配信物に対して機械的に確認する。
 * ライセンスは全て SIL Open Font License 1.1(public/fonts/OFL.txt)。
 */
`
const blocks = Object.entries(manifest).map(([file, entry]) => {
  const count = entry.text === undefined ? 'ラテン範囲' : `${[...entry.text].length}文字`
  return `/* ${entry.family} — ${NOTES[file] ?? ''}
   対象: ${count}。実体: public/fonts/${file}.woff2 */
@font-face {
  font-family: '${entry.family}';
  font-style: normal;
  font-weight: ${entry.weight};
  font-display: swap;
  src: url('/fonts/${file}.woff2') format('woff2');
  unicode-range:
${wrapRange(entry.unicodeRange)};
}`
})
writeFileSync(path.join(ROOT_DIR, 'src/styles/fonts.css'), `${header}\n${blocks.join('\n\n')}\n`)

console.log(`build-font-subsets: ${jobs.length - failed}/${jobs.length} 生成 · fonts.css 書き出し`)
process.exit(failed === 0 ? 0 : 1)
