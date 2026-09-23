// out/ の自己整合性検査。二言語版 404 を out/404.html へ戻したうえで、次を見る:
//   - 404 の中身(out/404.html は ja/ko の案内があり村の殻が無い、out/404/index.html は not-found の出力)
//   - 必須ページの実在
//   - HTML が参照する css/js・スプライトシート・同じオリジンの静的ファイル(public/ 由来)の実在と中身
//   - 入口の本文に村の舞台が焼かれているか
// 参照が0件なら「全部揃っている」ではなく「検査できていない」なので exit 1
import { readdirSync, readFileSync, existsSync, statSync, copyFileSync } from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('out')
if (!existsSync(OUT)) {
  console.error('verify-export: out/ が無い。先に next build を実行すること')
  process.exit(1)
}

// next build は public/404.html を自前の英語 404 で上書きする(App Router の _not-found 出力)。
// GitHub Pages が使うのは out/404.html なので、ここで二言語版を戻してから中身を確かめる。
//
// ただし複製してから out/404.html の存在を見ても、確かめているのは自分が今置いたファイルであって
// next build の出力ではない。next build が 404 を出さなくなっても気づけないので、
// 複製の前に「ビルドの 404 出力があるか」を先に確かめる。
// trailingSlash: true の export は not-found を out/404/index.html にも出す(next.config.ts)。
// こちらはこのスクリプトが一切書かないので、ビルド出力そのものの証拠になる
const NOT_FOUND_SRC = path.resolve('public', '404.html')
const NOT_FOUND_DST = path.join(OUT, '404.html')
const NOT_FOUND_ROUTE = path.join(OUT, '404', 'index.html')
let failed = false
for (const [label, target] of [
  ['out/404/index.html', NOT_FOUND_ROUTE],
  ['out/404.html', NOT_FOUND_DST],
]) {
  if (!existsSync(target)) {
    console.error(`verify-export: next build の 404 出力が無い: ${label}`)
    failed = true
    continue
  }
  if (statSync(target).size === 0) {
    console.error(`verify-export: next build の 404 出力が空: ${label}`)
    failed = true
  }
}
copyFileSync(NOT_FOUND_SRC, NOT_FOUND_DST)

// 存在と大きさだけでは、入口の index.html を複製したような「404 のふりをした別ページ」が通る。
// ここからは実際に配る中身を見る。out/404.html は上で複製した後の(= アップロードされる)ファイル。
// 村の舞台(data-village-*)や Next の束(/_next/)を抱えていたら、404 ではなくアプリの殻を配っている
const APP_SHELL_MARKERS = ['data-village', '/_next/']
const NOT_FOUND_GUIDES = [
  ['ja', '<section lang="ja">', 'ページが見つかりません'],
  ['ko', '<section lang="ko">', '페이지를 찾을 수 없습니다'],
]
const notFoundHtml = readFileSync(NOT_FOUND_DST, 'utf-8')
for (const [lang, section, heading] of NOT_FOUND_GUIDES) {
  if (!notFoundHtml.includes(section) || !notFoundHtml.includes(heading)) {
    console.error(`verify-export: out/404.html に ${lang} の案内が無い(${section} / ${heading})`)
    failed = true
  }
}
for (const marker of APP_SHELL_MARKERS) {
  if (notFoundHtml.includes(marker)) {
    console.error(`verify-export: out/404.html が 404 ではなくアプリの殻を含む: ${marker}`)
    failed = true
  }
}
// out/404/index.html は next build の not-found そのもの(英語の既定版)。Next は not-found に
// robots noindex を必ず付けるので、それを「404 として出力された」印に使う。村の印があれば入口の複製
if (existsSync(NOT_FOUND_ROUTE)) {
  const routeHtml = readFileSync(NOT_FOUND_ROUTE, 'utf-8')
  if (!/<meta name="robots" content="noindex"\/>/.test(routeHtml)) {
    console.error(
      'verify-export: out/404/index.html に robots noindex が無い。not-found の出力ではない'
    )
    failed = true
  }
  if (routeHtml.includes('data-village')) {
    console.error('verify-export: out/404/index.html が村の舞台を含む。not-found の出力ではない')
    failed = true
  }
}

const walk = dir =>
  readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

const htmlFiles = walk(OUT).filter(p => p.endsWith('.html'))
const REQUIRED = [
  'index.html',
  'ko/index.html',
  'list/index.html',
  'ko/list/index.html',
  'works/meishi-cross-platform/index.html',
  'ko/works/meishi-cross-platform/index.html',
  '404.html',
]
for (const rel of REQUIRED) {
  if (!existsSync(path.join(OUT, rel))) {
    console.error(`verify-export: 必須ページが無い: ${rel}`)
    failed = true
  }
}

let refs = 0
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf-8')
  const matches = [...html.matchAll(/(?:href|src)="(\/_next\/[^"]+\.(?:css|js))"/g)]
  for (const [, ref] of matches) {
    refs += 1
    // ルートグループや動的セグメントを含むチャンク名は HTML 側で percent-encode される
    // (例: app/(ja)/works/%5Bslug%5D/…)。実ファイル名は素の [slug] なので復号して突き合わせる
    const abs = path.join(OUT, decodeURIComponent(ref))
    if (!existsSync(abs)) {
      console.error(`verify-export: ${path.relative(OUT, file)} が参照する ${ref} が無い`)
      failed = true
      continue
    }
    // 存在だけを見ると 0 バイトのチャンクが通る。スタイルもスクリプトも中身が空なら
    // 「HTML は出ているのに何も効かないサイト」を配ることになるので、スプライトと同じく大きさまで見る
    if (statSync(abs).size === 0) {
      console.error(`verify-export: ${path.relative(OUT, file)} が参照する ${ref} が空(0 bytes)`)
      failed = true
    }
  }
}
if (refs === 0) {
  console.error('verify-export: css/js の参照が0件。検査が成立していない')
  failed = true
}

// スプライトシートは public/sprites へ焼いた実ファイル(scripts/build-sprites.mjs)。
// 焼き損ねても HTML は今までどおり出るので、参照先が空のまま「村が見えないサイト」を
// 配ってしまう。ここで実体と中身まで見て落とす。PNG の署名まで確かめるのは、
// 0 バイトではないが中身が壊れている(途中で切れた等)場合も通さないため
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const spriteRefs = new Set()
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf-8')
  for (const [ref] of html.matchAll(/\/sprites\/[a-z0-9-]+\.png/g)) spriteRefs.add(ref)
}
for (const ref of spriteRefs) {
  const abs = path.join(OUT, ref)
  if (!existsSync(abs)) {
    console.error(`verify-export: HTML が参照するシートが無い: ${ref}`)
    failed = true
    continue
  }
  const bytes = readFileSync(abs)
  if (bytes.length === 0 || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    console.error(`verify-export: シートが空か PNG ではない: ${ref} (${bytes.length} bytes)`)
    failed = true
  }
}
if (spriteRefs.size === 0) {
  console.error('verify-export: スプライトシートの参照が0件。検査が成立していない')
  failed = true
}

// public/ から出る静的ファイル(ロゴ・スクリーンショット・favicon・OG 画像など)の参照。
// HTML 属性だけでなく RSC ペイロード(\"/logos/…png\" のようにエスケープされた JSON 文字列)にも
// 書かれ、村のモーダルはそちらから描くので、引用符の前の \\ を許して両方を拾う。
// OG 画像は絶対 URL(src/lib/metadata.ts の SITE = https://j-paku.github.io)で書かれるので同じオリジンとして扱う。
// 拡張子の無いページ経路(/list/ など)は対象外。同じオリジンに別リポジトリの Pages
// (/seatmap-demo/ など)が載っており out/ には無いのが正しいため。ページは REQUIRED で見ている
const STATIC_REF =
  /\\?"(?:https:\/\/j-paku\.github\.io)?(\/(?!\/|_next\/)[^"\\\s<>?#]*\.[a-z0-9]+)(?:[?#][^"\\\s<>]*)?\\?"/g
const staticRefs = new Map()
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf-8')
  for (const [, ref] of html.matchAll(STATIC_REF)) {
    if (!staticRefs.has(ref)) staticRefs.set(ref, path.relative(OUT, file))
  }
}
for (const [ref, from] of staticRefs) {
  const abs = path.join(OUT, decodeURIComponent(ref))
  if (!existsSync(abs) || statSync(abs).size === 0) {
    console.error(`verify-export: ${from} などが参照する ${ref} が out/ に無いか空`)
    failed = true
  }
}
if (staticRefs.size === 0) {
  console.error('verify-export: 静的ファイルの参照が0件。検査が成立していない')
  failed = true
}

// 参照の整合だけでは「中身が空の殻」を配っても全部通る。入口の本文に村の舞台が
// 焼かれていることまで見る。静的エクスポートなので舞台は HTML の中に文字列として在る
// (out/index.html を実際に読んで選んだ印。Village が枠・地形・主人公へ立てる data 属性)
const INDEX_MARKERS = ['data-village-terrain', 'data-village-player']
for (const rel of ['index.html', 'ko/index.html']) {
  const abs = path.join(OUT, rel)
  if (!existsSync(abs)) continue
  const html = readFileSync(abs, 'utf-8')
  for (const marker of INDEX_MARKERS) {
    if (!html.includes(marker)) {
      console.error(`verify-export: ${rel} の本文に村の印が無い: ${marker}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log(
  `verify-export: OK (${htmlFiles.length} html, ${refs} refs, ${spriteRefs.size} sprite sheets, ${staticRefs.size} static files)`
)
