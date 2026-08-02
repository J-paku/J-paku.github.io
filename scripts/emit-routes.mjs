// SPA の直リンクを実 200 にするため、ルートごとに dist/index.html の複製を配置するスクリプト。
// `npm run build`(vite build)の直後に実行する前提。
//
// ラウト一覧は content/ja/works/*.ts を実際にモジュールとして読み込み、work.status / work.slug から作る。
// 「公開作品」の判定はアプリ側(src/utils/content-loader.ts)と同じ work.status を直接見るため、
// 判定基準が二重化しない。作品ファイルを1個追加すればラウトも自動で増え、このスクリプト自体は書き換えない。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const WORKS_DIR = path.join(ROOT_DIR, 'content/ja/works')
const DIST_DIR = path.join(ROOT_DIR, 'dist')

// content/ 配下の import は type-only のみ(値の import は無い)ことを前提に、
// esbuild で TypeScript の型注釈だけを落として ESM コードへ変換し、data: URL 経由で直接評価する。
// モジュール解決を行わないため tsconfig の path alias 等には依存しない。
function transformWorkFile(file) {
  const source = readFileSync(path.join(WORKS_DIR, file), 'utf-8')
  const { code } = transformSync(source, { loader: 'ts', format: 'esm' })
  return code
}

// 変換済みコードを実際に import して Work オブジェクトを取り出す。
// export忘れ・想定外の形は失敗として扱い、スキップせず例外を投げる
async function loadWork(file) {
  const code = transformWorkFile(file)
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  const moduleExports = await import(dataUrl)
  const work = Object.values(moduleExports)[0]
  if (!work || typeof work.slug !== 'string' || typeof work.status !== 'string') {
    throw new Error(`${file} から Work のexportを取得できなかった`)
  }
  return work
}

// content/ja/works/*.ts を全件読み込み、published な slug 一覧を返す。
// 読み込み・評価の失敗、件数不一致、published が0件のいずれも例外を投げて呼び出し元で非ゼロ終了させる
async function loadPublishedSlugs() {
  const files = readdirSync(WORKS_DIR).filter((name) => name.endsWith('.ts'))

  const works = []
  for (const file of files) {
    try {
      works.push(await loadWork(file))
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`emit-routes: ${file} の読み込みに失敗した — ${reason}`)
    }
  }

  if (works.length !== files.length) {
    throw new Error(
      `emit-routes: 読み込めた作品数(${works.length})がファイル数(${files.length})と一致しない`,
    )
  }

  const publishedSlugs = works
    .filter((work) => work.status === 'published')
    .map((work) => work.slug)

  if (publishedSlugs.length === 0) {
    throw new Error('emit-routes: published な作品が1件も見つからない')
  }

  return publishedSlugs
}

let publishedSlugs
try {
  publishedSlugs = await loadPublishedSlugs()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
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
