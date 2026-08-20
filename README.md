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
- **書体は Google Fonts 配信** — unicode-range 分割済みで、そのページが描く符号位置のスライスだけが落ちてくる
- ライト / ダークテーマ(右上の設定メニューで言語と一緒に切替)

## 設計上の決定

デザインの方向性は [DESIGN.md](DESIGN.md) に分離してあるので、ここでは仕組みの決定だけを書きます。

- **locale は `location.pathname` からのみ決まる。** 自動リダイレクトも `?lang=` も作らない — URL がそのまま真実になる
- **表示文字列はすべて `content/`(ja・ko)に置き、コンポーネントにハードコードしない。** 両言語は同一の型を満たすため、翻訳キーの過不足は `tsc` が検出する。ko 側の空欄は ja へフォールバックする安全網(merge)付き
- **`localStorage` へのアクセスは 1 ファイルに集約**(`src/lib/preferences.ts`)
- **書体は自前でサブセット化せず、Google Fonts から配信する。** 以前は「描画された文字だけ」を機械的に集めて作り直す仕組みを持っていたが、画面を操作して文字を集める都合上マークアップの変更で黙って壊れ、実際に文言がシステムフォントで配信されていた。転送量は増える(実測 `/` で 244KB → 967KB)が、コンテンツを足してもフォント側の作業が要らなくなる方を採った
- **書体CSSは描画を止めない。** `media="print"` + `onload` で読み込む。素の `<link>` にすると取得完了まで最初の描画が始まらない(実測: レンダーブロック 1170ms・FCP 2.6s・Lighthouse性能 92 → 非ブロック化で 150ms・1.6s・94)。`display=swap` なのでどちらにせよ本文は代替書体で先に出るため、止める意味が無い
- **静的配信の SPA で直リンクを実 200 にする** — ルートごとに `dist/index.html` を複製する後処理(`scripts/emit-routes.mjs`)
- **色はトークン1ファイル**(`src/styles/tokens.css`)。リテラル禁止なのでテーマ切替から漏れる色が出ない

## 品質とCI

`main` への push で GitHub Actions がビルドし、**配信物に対して**次を実測してから Pages へ出します。

| 検査 | 内容 |
|---|---|
| typecheck / test / lint | `tsc -b` / Vitest / oxlint |
| アクセシビリティ | axe による WCAG 違反 0 件チェック(全ルート) |
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

書体は Google Fonts から配信します(`index.html` の `<link>`、`/ko/` 用の差し替えは
`scripts/emit-routes.mjs`)。unicode-range で分割済みのため、コンテンツに文字を足しても
フォント側の作業は要りません。

> 配信は Settings → Pages → Source を「GitHub Actions」にした状態で `main` への push により行われます。

</div>
