// SPA の直リンクを実 200 にするため、ルートごとに dist/index.html の複製を配置するスクリプト。
// `npm run build`(vite build)の直後に実行する前提。
//
// 08段階(08-layout-restructure.md §2)でケーススタディ詳細ルートを廃したため、
// 複製が要るのは ko トップと 404.html だけになった。ja トップは vite build が
// dist/index.html として既に出力しているので複製しない。
//
// 以前あった content/ja/works/*.ts の読み込み(published slug から works/ ラウトを生成する処理)は
// 生成対象そのものが無くなったため削除した。作品を増やしてもラウトは増えない。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')

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

emitRoute('ko')

// 404.html は index.html の複製 — 上記以外の未知パスを拾う最後の網
writeFileSync(path.join(DIST_DIR, '404.html'), shellHtml)
console.log('emit-routes: 404.html')
