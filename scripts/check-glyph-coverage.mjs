// 描画された日本語・韓国語の文字が、全て自己ホストのサブセットフォントで組まれているかを検査する。
//
// なぜ必要か: フォントは配信ページに実際に描画された文字だけをサブセットしている(fonts.css)。
// コンテンツに新しい文字が増えると、その文字だけサブセットから外れてシステムフォントへ落ち、
// 1つの文字列の中でラテンとCJKが別書体になる。D5より前の状態がまさにそれで、
// 『AIエージェント開発環境』が AI だけ Playfair・残りは環境依存のゴシックで出ていた。
// この壊れ方はビルドも型チェックも通り、画面を人が見るまで分からない。
//
// 判定範囲は CJK・かな・ハングルだけに絞る。ラテンの数字や記号(NO.01 の . など)は
// --f-mono の先頭 ui-monospace が受ける設計なので、システムフォントで正しい。
//
// 使い方: node scripts/check-glyph-coverage.mjs <baseUrl> <path> [path...]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

const [, , baseUrl, ...targetPaths] = process.argv

if (baseUrl === undefined || targetPaths.length === 0) {
  console.error('使い方: node scripts/check-glyph-coverage.mjs <baseUrl> [path...]')
  process.exit(2)
}

// 自己ホストしているフォントの被覆表。ここに無い font-family は「システム」として扱う
const manifest = JSON.parse(
  readFileSync(path.join(ROOT_DIR, 'scripts/subset-manifest.json'), 'utf8'),
)

// unicode-range を実コードポイント集合へ展開する。項目数ではなく被覆で判定するため
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

// family ごとに「太さ違いのフェイス」を並べて持つ。太さを見ないと、400のフェイスが
// 文字を持っているだけで通ってしまい、700要求が合成ボールドになっている状態を見逃す
const coverage = {}
for (const entry of Object.values(manifest)) {
  ;(coverage[entry.family] ??= []).push({
    weight: String(entry.weight),
    codes: [...expandRange(entry.unicodeRange)],
  })
}

const browser = await chromium.launch()
let totalGuarded = 0
let totalFailures = 0

for (const targetPath of targetPaths) {
  const url = new URL(targetPath, baseUrl).href
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(600)

  // DOMを1回だけスキャンする方式だと、状態によって文言が入れ替わるトグル
  // (畳んだ状態の '詳しく見る' ⇔ 開いた状態の '閉じる' など)は片方しかDOMに存在せず、
  // もう片方の文言が検査対象から漏れる。そのためトグルを1つ開くたびにスキャンし、
  // 文字を合集合にしてから判定する。判定ロジック自体(resolve など)はここでは変えない
  const scanGlyphs = () =>
    page.evaluate((coverageEntries) => {
      const covered = new Map(
        Object.entries(coverageEntries).map(([family, faces]) => [
          family,
          faces.map((face) => ({ weight: face.weight, codes: new Set(face.codes) })),
        ]),
      )

      // CJK・かな・ハングルだけを検査対象にする
      const isGuarded = (code) =>
        (code >= 0x3000 && code <= 0x303f) ||
        (code >= 0x3040 && code <= 0x30ff) ||
        (code >= 0x31f0 && code <= 0x31ff) ||
        (code >= 0x3400 && code <= 0x9fff) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0x1100 && code <= 0x11ff) ||
        (code >= 0x3130 && code <= 0x318f) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xff66 && code <= 0xff9f)

      const parseFamilies = (value) =>
        value.split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, ''))

      // 可変フォントの太さ指定('100 900')は範囲として扱う
      const weightMatches = (faceWeight, wanted) => {
        if (faceWeight.includes(' ')) {
          const [from, to] = faceWeight.split(' ').map(Number)
          return Number(wanted) >= from && Number(wanted) <= to
        }
        return faceWeight === String(wanted)
      }

      // font-family チェーンを前から見て、最初にその文字を持つフォントを決める。
      // 自己ホスト側で見つかれば OK、システム側に到達したら NG(何が当たるか環境依存になる)。
      // 文字はあるが太さが無い場合はブラウザが合成する — これも劣化なので別種のNGにする
      const resolve = (code, families, weight) => {
        for (const family of families) {
          const faces = covered.get(family)
          if (faces === undefined) return { ok: false, kind: 'system', by: family }
          const hit = faces.filter((face) => face.codes.has(code))
          if (hit.length === 0) continue
          if (hit.some((face) => weightMatches(face.weight, weight))) return { ok: true, by: family }
          return { ok: false, kind: 'weight', by: `${family} w${hit.map((f) => f.weight).join('/')}` }
        }
        return { ok: false, kind: 'system', by: 'initial' }
      }

      const guarded = new Map()
      const failures = new Map()
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const element = node.parentElement
        if (element === null) continue
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        const families = parseFamilies(style.fontFamily)
        const weight = style.fontWeight
        for (const char of node.textContent ?? '') {
          const code = char.codePointAt(0)
          if (code === undefined || !isGuarded(code)) continue
          const verdict = resolve(code, families, weight)
          const key = `${char} ${families[0]}`
          if (verdict.ok) {
            guarded.set(key, { char, font: verdict.by, weight, chainHead: families[0] })
          } else {
            const tag = element.tagName.toLowerCase()
            const cls = element.className === '' ? '' : `.${String(element.className).split(' ')[0]}`
            failures.set(key, {
              char,
              at: `${tag}${cls}`,
              weight,
              kind: verdict.kind,
              chainHead: families[0],
              stoppedAt: verdict.by,
            })
          }
        }
      }
      return { guarded: [...guarded.values()], failures: [...failures.values()] }
    }, coverage)

  // 1巡目: 初期状態(詳細は畳まれ、設定メニューも閉じている)。'詳しく見る' などの
  // 畳み状態の文言はここでしか拾えない
  const scans = [await scanGlyphs()]

  // 折りたたまれた詳細(WorkDetail など)は hidden 属性で畳まれている — DOMに文字が存在していても
  // 非表示のままでは被覆漏れを検出できないため、開閉トグルを全て一度開いておく。
  // 設定メニューのボタンは aria-controls を持つことがあるので、aria-haspopup=true 側は除外する
  //
  // クリックを全部済ませてから1回だけ走査するのではなく、1つ開くたびに走査して合集合へ足す。
  // 経歴の詳細トグルは排他(3件のうち1件だけが右列に出る)なので、まとめて開いてから走査すると
  // 最後にクリックした1件の文字しか検査されず、残り2件はサブセットから落ちていても検査に
  // 現れない — つまり PASS 方向に間違う(03-pitfalls #5・#7 と同じ壊れ方)
  const detailToggles = await page.$$('button[aria-controls]:not([aria-haspopup=true])')
  for (const toggle of detailToggles) {
    // 経歴トリガーを押すと作品一覧パネルが hidden になるため、その中にある後続のトグルは
    // 不可視になりクリックがタイムアウトして検査自体が落ちる。押す直前に祖先の hidden だけ
    // 外して押せる状態へ戻す(最後の一括解除と同じ処置。開いた中身の採取にも要る)
    await toggle.evaluate((el) => {
      for (let node = el.parentElement; node !== null; node = node.parentElement) {
        if (node.hasAttribute('hidden')) node.removeAttribute('hidden')
      }
    })
    await toggle.click()
    await page.waitForTimeout(200)
    scans.push(await scanGlyphs())
  }

  // 詳細トグルには外側クリックで閉じる仕組みが無く、先に開いても後続の操作の影響を受けない。
  // 一方 SettingsMenu は外側 pointerdown で自動的に閉じるため、後から開かないと
  // 詳細トグルのクリックに巻き込まれて閉じてしまう。だから設定メニューは最後に開く
  const settingsButton = await page.$('button[aria-haspopup=true]')
  if (settingsButton !== null) {
    await settingsButton.click()
    await page.waitForTimeout(200)
  }

  // aria-controls の順次クリックだけでは、外側クリックで閉じるポップオーバー(TechChipPopover)は
  // 最後の1個しか開いたまま残らない。hidden 属性を一括解除してポップオーバー本文を
  // 全て露出させ、合集合スキャンを成立させる
  await page.evaluate(() => {
    document.querySelectorAll('[hidden]').forEach((el) => el.removeAttribute('hidden'))
  })
  await page.waitForTimeout(200)

  // 最終パス: 詳細トグル・設定メニューを開いた状態。'閉じる' など開き状態でだけ入れ替わる
  // 文言や、パネル内の文字(言語を選択・テーマを切り替え等)はここで拾う
  scans.push(await scanGlyphs())

  // 全パスのスキャンを文字+フォントチェーン単位の合集合にする。同じ組み合わせが複数の状態に
  // あれば1件に畳み、どれか1つの状態で不合格だった組み合わせは合格側があっても不合格を優先する
  // (検出漏れを防ぐのがこの合集合の目的なので、より厳しい判定を残す)
  const guardedByKey = new Map()
  for (const scan of scans) {
    for (const item of scan.guarded) {
      guardedByKey.set(`${item.char} ${item.chainHead}`, item)
    }
  }
  const failuresByKey = new Map()
  for (const scan of scans) {
    for (const item of scan.failures) {
      const key = `${item.char} ${item.chainHead}`
      guardedByKey.delete(key)
      failuresByKey.set(key, item)
    }
  }
  const result = { guarded: [...guardedByKey.values()], failures: [...failuresByKey.values()] }

  const usedFonts = [...new Set(result.guarded.map((item) => item.font))].sort()
  // 検査した総数は OK と NG の合計。OK の数で0件判定をすると、全滅したページを
  // 「検査できていない」と誤って報告してしまう
  const inspected = result.guarded.length + result.failures.length
  totalGuarded += inspected
  totalFailures += result.failures.length

  if (inspected === 0) {
    // 対象0件は「全部揃っている」ではなく「検査できていない」。PASS にすると検査が消える
    console.error(`[FAIL] ${targetPath}: 検査対象のCJK/ハングルが0件。描画前に判定した可能性がある`)
    totalFailures += 1
    await page.close()
    continue
  }

  if (result.failures.length === 0) {
    console.log(`[OK] ${targetPath}: 対象 ${inspected}種すべて自己ホスト(${usedFonts.join(' / ')})`)
  } else {
    console.log(
      `[FAIL] ${targetPath}: 対象 ${inspected}種のうち ${result.failures.length}種がシステムフォントへ落ちる`,
    )
    for (const item of result.failures) {
      const reason =
        item.kind === 'weight'
          ? `太さ ${item.weight} の実物フェイスが無く、合成される(${item.stoppedAt})`
          : `${item.stoppedAt} でシステムフォントになり環境依存`
      console.log(`  '${item.char}' w${item.weight} @ ${item.at} — ${reason}`)
    }
  }
  await page.close()
}

await browser.close()

console.log(`check-glyph-coverage: 対象 ${totalGuarded}種 / 自己ホスト外 ${totalFailures}種`)
process.exit(totalFailures === 0 ? 0 : 1)
