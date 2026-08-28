// SPA の直リンクを実 200 にするため、ルートごとに dist/index.html の複製を配置するスクリプト。
// `npm run build`(vite build)の直後に実行する前提。
//
// 08段階(08-layout-restructure.md §2)で廃したケーススタディ詳細ルートは、作品ストーリーページ
// (/works/<slug>)として復活した。複製が要るのは ko トップ・404.html に加え、story を持つ
// 作品ごとの ja/ko 2ルート。ja トップは vite build が dist/index.html として既に出力しているので
// 複製しない。
//
// published slug から works/ ラウトを自動生成する仕組み(content/ja/works/*.ts の読み込み)は
// 08段階で削除したままで、自動化はしていない。story を持つ作品を増やすときは、下の emitRoute に
// その slug の ja/ko 2行を手動で追加する。
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

// ko ページ用の書体リンク。ja 側は index.html が持っており、ここでは ko の分だけを定義する。
// 日本語の『日本語』(言語切替ラベル)は Noto Sans KR が漢字を持つので描ける。逆向き
// (ja ページのハングル)は JP に glyph が無いため index.html 側で text= の1枚を足している
// media/onload は index.html 側と同じ理由(描画を止めない)
const KO_FONT_LINK =
  '<link rel="stylesheet" data-fonts="ko" media="print" onload="this.media=\'all\'" href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@400&family=Playfair+Display:wght@400&display=swap" />'

// ko ページ用の meta description・og:description の文言。og:locale の ko_KR 化とあわせて
// ko 複製時にだけ差し替える(og:title・og:site_name はブランド名なので ja/ko 共通のまま)
const KO_DESCRIPTION =
  '읽기만 하는 포트폴리오가 아닙니다. 좌석 지도도 명함 앱도 여기서 실제로 움직입니다. 만들고 운영까지 가져가는 프론트엔드 엔지니어.'

// ko ページ用の <noscript data-fallback>。ja 側の正本は index.html にあり、
// ko 複製時に中身を丸ごとこの文字列へ差し替える(構造は ja と同一に保つ)
const KO_NOSCRIPT = `<noscript data-fallback>
      <div style="max-width: 40em; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.9">
        <h1>J-Paku</h1>
        <p>업무 시스템 UI·iOS·AI 개발 기반 포트폴리오. 본문은 JavaScript로 그려지기 때문에, 이 환경에서는 개요만 표시합니다.</p>
        <p>전사 200명 이상이 사용하는 사내 업무 앱(9기능·418라우트·TypeScript 16만 행)의 프론트엔드를 설계·구현. AI 에이전트 개발 환경(하네스)으로 AI에 맡긴 작업의 87.6%가 사람의 손질 없이 완료.</p>
        <ul>
          <li><a href="https://j-paku.github.io/seatmap-demo/">좌석 지도 데모 — 실제로 움직입니다</a></li>
          <li><a href="https://j-paku.github.io/ai-harness/">AI 에이전트 개발 환경 기록</a></li>
          <li><a href="https://github.com/J-paku">GitHub (J-paku)</a></li>
        </ul>
      </div>
    </noscript>`

// routeDir へ dist/index.html の複製を書き出す。routeDir は DIST_DIR からの相対パス。
// lang を渡すと <html lang> と書体リンクを差し替える — フォントのチェーンを
// :root[lang='ko'] で切り替えているため、JSが lang を立てる前の初回ペイントで
// 日本語フォントが要求されてしまうのを防ぐ
function emitRoute(routeDir, lang) {
  const dir = path.join(DIST_DIR, routeDir)
  mkdirSync(dir, { recursive: true })
  const outPath = path.join(dir, 'index.html')
  let html = lang === undefined ? shellHtml : shellHtml.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
  if (lang !== undefined && html === shellHtml) {
    console.error(`emit-routes: <html lang> を差し替えられなかった(${routeDir})`)
    process.exit(1)
  }
  if (lang === 'ko') {
    // ja 用の2枚(本体 + ハングル3文字)を ko 用の1枚に置き換える。
    // 差し替えられなかったら黙って ja のフォントを配ることになるので、そこで止める
    // ビルド後のHTMLでは属性が複数行に分かれて残るため、改行をまたげる書き方にする
    const swapped = html
      .replace(/<link[^>]*data-fonts="ja"[^>]*>/, KO_FONT_LINK)
      .replace(/<link[^>]*data-fonts-alt="ja"[^>]*>/, '')
    if (swapped === html || swapped.includes('data-fonts="ja"') || swapped.includes('data-fonts-alt="ja"')) {
      console.error(`emit-routes: 書体リンクを ko へ差し替えられなかった(${routeDir})`)
      process.exit(1)
    }
    html = swapped

    // description・og:description・og:locale を ko 用に差し替える。こちらも改行をまたげる書き方にする
    const metaSwapped = html
      .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${KO_DESCRIPTION}"`)
      .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${KO_DESCRIPTION}"`)
      .replace(/<meta property="og:locale" content="[^"]*"/, '<meta property="og:locale" content="ko_KR"')
    const koDescriptionCount = metaSwapped.split(KO_DESCRIPTION).length - 1
    if (
      koDescriptionCount !== 2 ||
      !metaSwapped.includes('og:locale" content="ko_KR"') ||
      metaSwapped.includes('og:locale" content="ja_JP"')
    ) {
      console.error(`emit-routes: description・og:description・og:locale を ko へ差し替えられなかった(${routeDir})`)
      process.exit(1)
    }
    html = metaSwapped

    // <noscript data-fallback> の中身を ko 文言へ丸ごと差し替える。差し替え失敗を黙って
    // ja のまま配らないよう、ko 固有文字列の存在と ja 文言の不在を両方検査する
    const noscriptSwapped = html.replace(/<noscript data-fallback>[\s\S]*?<\/noscript>/, KO_NOSCRIPT)
    if (
      noscriptSwapped === html ||
      !noscriptSwapped.includes('사람의 손질 없이 완료') ||
      noscriptSwapped.includes('人の手直しなしで完了。')
    ) {
      console.error(`emit-routes: noscript フォールバックを ko へ差し替えられなかった(${routeDir})`)
      process.exit(1)
    }
    html = noscriptSwapped
  }

  // og:url は lang と無関係に、複製先ルートの実URLへ差し替える。ja トップ(shellHtml 原本)は
  // vite 出力そのままで既に https://j-paku.github.io/ なので、emitRoute を経由しない限り触らない
  const routeUrl = `https://j-paku.github.io/${routeDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/`
  const urlSwapped = html.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${routeUrl}"`)
  if (urlSwapped === html || !urlSwapped.includes(`og:url" content="${routeUrl}"`)) {
    console.error(`emit-routes: og:url を差し替えられなかった(${routeDir})`)
    process.exit(1)
  }
  html = urlSwapped

  writeFileSync(outPath, html)
  console.log(`emit-routes: ${path.relative(ROOT_DIR, outPath)} (lang=${lang ?? 'ja'})`)
}

emitRoute('ko', 'ko')

// 作品ストーリーページ。story を持つ作品を増やすたびに ja/ko の2行をここへ追加する
emitRoute('works/meishi-cross-platform')
emitRoute('ko/works/meishi-cross-platform', 'ko')

// 404.html は index.html の複製 — 上記以外の未知パスを拾う最後の網
writeFileSync(path.join(DIST_DIR, '404.html'), shellHtml)
console.log('emit-routes: 404.html')
