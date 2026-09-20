// out/ の自己整合性検査。HTML が参照する css/js が同じツリーに実在するかを見る。
// 参照が0件なら「全部揃っている」ではなく「検査できていない」なので exit 1
import { readdirSync, readFileSync, existsSync, statSync, copyFileSync } from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('out')
if (!existsSync(OUT)) {
  console.error('verify-export: out/ が無い。先に next build を実行すること')
  process.exit(1)
}

// next build は public/404.html を自前の英語 404 で上書きする(App Router の _not-found 出力)。
// GitHub Pages が使うのは out/404.html なので、ここで二言語版を戻してから中身を確かめる
const NOT_FOUND_SRC = path.resolve('public', '404.html')
const NOT_FOUND_DST = path.join(OUT, '404.html')
copyFileSync(NOT_FOUND_SRC, NOT_FOUND_DST)
const notFoundHtml = readFileSync(NOT_FOUND_DST, 'utf-8')
if (!notFoundHtml.includes('lang="ja"') || !notFoundHtml.includes('lang="ko"')) {
  console.error('verify-export: out/404.html が二言語版になっていない')
  process.exit(1)
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
let failed = false
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
    if (!existsSync(path.join(OUT, decodeURIComponent(ref)))) {
      console.error(`verify-export: ${path.relative(OUT, file)} が参照する ${ref} が無い`)
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

if (failed) process.exit(1)
console.log(
  `verify-export: OK (${htmlFiles.length} html, ${refs} refs, ${spriteRefs.size} sprite sheets)`
)
