<!-- GitHub は README を lang="en" のページに埋め込むため、ブラウザが日本語の CJK 字形を
     選べず、中国語・韓国語の字形へ落ちる。本文を lang="ja" で包んで字形を確定させる。
     空行を挟むと中の Markdown は通常どおり解釈される -->
<div lang="ja">

# J-paku.github.io

ポートフォリオハブサイトです。`https://j-paku.github.io/` に GitHub Pages のユーザーサイトとして配信しています。

## これは何か

seatmap-demo・ai-harness・名刺登録アプリなどの作品をまとめ、「何を作ったか」だけでなく
**「なぜそう作ったか」** を見せるためのサイトです。作品ごとに、実際に踏んだ不具合と
その解決(カード内の折りたたみ詳細)や、iPhone 枠の中で画面が切り替わるスクロール
ストーリー(専用ページ `/works/…`)を用意しています。

## 主な特徴

- **日本語 / 한국어 の2言語** — 言語は URL パスだけで決まる(`/` = ja、`/ko` = ko)
- **作品の見せ方を作品ごとに設計** — 折りたたみ詳細(症状→原因→解決の実例+自作SVG構成図)と、端末枠スクロールストーリーの2系統
- **実キャプチャを使わない** — 業務データが写るため、画面はすべて自作SVG(図解・アニメーション)で再現
- **セルフホストのサブセットフォント** — 配信ページに実際に描画される文字だけを収録
- ライト / ダークテーマ(右上の設定メニューで言語と一緒に切替)

## 設計上の決定

デザインの方向性は [DESIGN.md](DESIGN.md) に分離してあるので、ここでは仕組みの決定だけを書きます。

- **locale は `location.pathname` からのみ決まる。** 自動リダイレクトも `?lang=` も作らない — URL がそのまま真実になる
- **表示文字列はすべて `content/`(ja・ko)に置き、コンポーネントにハードコードしない。** 両言語は同一の型を満たすため、翻訳キーの過不足は `tsc` が検出する。ko 側の空欄は ja へフォールバックする安全網(merge)付き
- **`localStorage` へのアクセスは 1 ファイルに集約**(`src/lib/preferences.ts`)
- **フォントは「描画された文字だけ」をサブセット化。** 文字集合はビルド済みページをスクリプトがクロールして機械的に採る — 人の記憶に依存させない。折りたたみやポップオーバーの中など、閉じた状態では見えない文字も開閉両状態の合集合で採取する
- **静的配信の SPA で直リンクを実 200 にする** — ルートごとに `dist/index.html` を複製する後処理(`scripts/emit-routes.mjs`)
- **色はトークン1ファイル**(`src/styles/tokens.css`)。リテラル禁止なのでテーマ切替から漏れる色が出ない

## 品質とCI

`main` への push で GitHub Actions がビルドし、**配信物に対して**次を実測してから Pages へ出します。

| 検査 | 内容 |
|---|---|
| typecheck / test / lint | `tsc -b` / Vitest / oxlint |
| アクセシビリティ | axe による WCAG 違反 0 件チェック(全ルート) |
| フォント被覆 | 描画された CJK・ハングルが全てセルフホストのサブセットで組まれているか |
| 日本語改行 | BudouX の文節に沿った改行だけか・禁則を破っていないかを複数幅で実測 |
| 性能 | Lighthouse 計測。結果はサイトのフッター(MEASURED)に掲示 |

ローカルの PASS だけでは完了と呼ばず、配信版でも同じ確認を繰り返す運用です。

## 技術スタック

`package.json` 記載のバージョンをそのまま記載しています。

| 分類 | 技術 | バージョン |
|---|---|---|
| ビルドツール | Vite | 8.2.0 |
| UI | React / React DOM | 19.2.8 |
| ルーティング | react-router | 7.18.2 |
| 言語 | TypeScript | 6.0.2 |
| スタイル | CSS Modules(追加パッケージなし・Vite標準機能) | - |
| 日本語改行 | BudouX | 0.9.0 |
| テスト | Vitest / Testing Library(react) | 4.1.10 / 16.3.2 |
| Lint | oxlint | 1.75.0 |
| 検証ハーネス | Playwright(a11y・フォント被覆・改行の実測) | 1.62.1 |
| CI/CD | GitHub Actions | - |

## ローカルでの実行

```bash
npm install
npm run dev
```

http://localhost:5173 で表示を確認できます。

```bash
npm run build       # tsc -b && vite build && emit-routes(dist/ を生成)
npm run preview     # ビルド結果をポート4173でプレビュー
npm run test        # vitest run
npm run typecheck   # tsc -b --noEmit
npm run lint        # oxlint
```

コンテンツに新しい文字を足したときは、ビルド済みの `dist/` を静的配信した上で
`node scripts/build-font-subsets.mjs <baseUrl> <path...>` を走らせてサブセットフォントを作り直します
(CI のフォント被覆検査が漏れを検出します)。

> 配信は Settings → Pages → Source を「GitHub Actions」にした状態で `main` への push により行われます。

</div>
