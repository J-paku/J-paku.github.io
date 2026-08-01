// SPA の直リンクを実 200 にするため、ルートごとに dist/index.html の複製を配置するスクリプト。
// `npm run build`(vite build)の直後に実行する前提。
//
// ラウト一覧は content/ja/works/*.ts から status: 'published' の slug を都度読み取って作る。
// 作品ファイルを1個追加すればラウトも自動で増え、このスクリプト自体は書き換えない。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const WORKS_DIR = path.join(ROOT_DIR, 'content/ja/works')
const DIST_DIR = path.join(ROOT_DIR, 'dist')

// 【脆弱性の注記】content/ja/works/*.ts は Node から直接 import できない(TypeScript のまま)ため、
// `slug: '...'` `status: '...'` を正規表現で抜き出す簡易パースに頼っている。
// この方式は Work オブジェクトの記法(引用符の種類・キー名・改行位置)が変わると
// マッチせず沈黙で0件になりうる。より頑丈にするなら tsx/esbuild-register 等で実際に
// モジュールを読み込む方式へ切り替える必要がある。
function extractPublishedSlugs() {
  const files = readdirSync(WORKS_DIR).filter((name) => name.endsWith('.ts'))
  const slugs = []

  for (const file of files) {
    const source = readFileSync(path.join(WORKS_DIR, file), 'utf-8')
    const slugMatch = source.match(/slug:\s*'([^']+)'/)
    const statusMatch = source.match(/status:\s*'([^']+)'/)

    if (!slugMatch || !statusMatch) {
      console.warn(`emit-routes: ${file} から slug/status を抽出できなかった(スキップ)`)
      continue
    }

    if (statusMatch[1] === 'published') {
      slugs.push(slugMatch[1])
    }
  }

  return slugs
}

const publishedSlugs = extractPublishedSlugs()
console.log('emit-routes: published slugs =', publishedSlugs)

const shellHtmlPath = path.join(DIST_DIR, 'index.html')
if (!existsSync(shellHtmlPath)) {
  console.error(`emit-routes: ${shellHtmlPath} が見つからない。先に vite build を実行すること`)
  process.exit(1)
}
const shellHtml = readFileSync(shellHtmlPath, 'utf-8')

// routeDir へ dist/index.html の複製を書き出す。routeDir は DIST_DIR からの相対パス
function emitRoute(routeDir) {
  const dir = path.join(DIST_DIR, routeDir)
  mkdirSync(dir, { recursive: true })
  const outPath = path.join(dir, 'index.html')
  writeFileSync(outPath, shellHtml)
  console.log(`emit-routes: ${path.relative(ROOT_DIR, outPath)}`)
}

const workRoutes = publishedSlugs.map((slug) => `works/${slug}`)

// ja(既定ロケール)側 — トップは vite build がすでに dist/index.html として生成済みなので作品ラウトのみ複製
for (const route of workRoutes) {
  emitRoute(route)
}

// ko 側 — トップを含め全ラウトを ko/ 配下に複製
emitRoute('ko')
for (const route of workRoutes) {
  emitRoute(path.join('ko', route))
}

// 404.html は index.html の複製 — 上記以外の未知パスを拾う最後の網
writeFileSync(path.join(DIST_DIR, '404.html'), shellHtml)
console.log('emit-routes: 404.html')
