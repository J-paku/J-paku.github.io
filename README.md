<!-- GitHubはREADMEをlang="en"のページに埋め込むため、ブラウザが日本語のCJK字形を選べず、
     中国語・韓国語の字形に落ちることがある。本文をlang="ja"で包んで字形を確定させる。
     空行を挟めば中のMarkdownは通常どおり解釈される -->
<div lang="ja">

# J-paku.github.io

ポートフォリオのハブサイト。GitHub Pagesのユーザーサイトとして`https://j-paku.github.io/`に配信しています。

**まずこの2つ。** どちらもブラウザだけで、そのまま触れます。

- [**座席マップデモ**](https://j-paku.github.io/seatmap-demo/) — オフィスの座席とチーム配置を、指の操作でそのまま扱う。実務の社内座席管理ツールをモックデータで再構成
- [**チーム標準のAI開発基盤**](https://j-paku.github.io/ai-harness/) — AIの行動をコードで縛り、チームへ配布・定着まで。導入2か月でチームのコード追加行数が約4倍

| 座席マップデモ | チーム標準のAI開発基盤 |
|---|---|
| [![座席マップデモ](https://j-paku.github.io/shots/seatmap-demo.svg)](https://j-paku.github.io/seatmap-demo/) | [![チーム標準のAI開発基盤](https://j-paku.github.io/shots/ai-harness.svg)](https://j-paku.github.io/ai-harness/) |

## これは何か

seatmap-demo・ai-harness・名刺登録アプリなどの作品を1か所にまとめ、「何を作ったか」だけでなく**「なぜそう作ったか」**まで見せるためのサイトです。作品ごとに、実際に踏んだ不具合とその解決を収めた折りたたみ詳細(カード内)や、iPhone枠の中で画面が切り替わるスクロールストーリー(専用ページ`/works/…`)を用意しています。

## 主な特徴

- **日本語/한국어の2言語対応** — 言語はURLパスだけで決まる(`/`=ja、`/ko`=ko)
- **見せ方を作品ごとに設計** — 症状→原因→解決の実例と自作SVG構成図を収めた折りたたみ詳細、端末枠スクロールストーリーの2系統
- **実キャプチャ不使用** — 業務データが写り込むため、画面はすべて自作SVG(図解・アニメーション)で再現
- **書体はGoogle Fonts配信** — unicode-range分割済みのため、ページが実際に描く符号位置のスライスだけが配信される
- **ライト/ダークテーマ** — 右上の設定メニューで言語と一緒に切り替え

## 設計上の決定

デザインの方向性は[DESIGN.md](DESIGN.md)にまとめているため、ここでは仕組みに関する決定だけを書きます。

- **localeは`location.pathname`だけで決める。** 自動リダイレクトも`?lang=`も設けず、URLを唯一の情報源にする
- **表示文字列はすべて`content/`(ja・ko)に置き、コンポーネントへハードコードしない。** 両言語が同一の型を満たすため、翻訳キーの過不足は`tsc`が検出する。ko側の空欄はjaへフォールバックする(merge)
- **`localStorage`へのアクセスは`src/lib/preferences.ts`の1ファイルに集約する。** 実運用の業務アプリでは永続データをIndexedDBに置いているが、本サイトはデモ用途で、保存するのが表示設定(テーマ・言語)だけのためlocalStorageで済ませている
- **書体は自前でサブセット化せず、Google Fontsから配信する。** 以前は描画された文字だけを機械的に収集してサブセットを作り直す仕組みがあったが、画面操作で文字を集める構造のためマークアップの変更で静かに壊れ、実際に一部の文言がシステムフォントで配信されていた。転送量は増える(実測で`/`が244KB→967KB)ものの、コンテンツを追加してもフォント側の作業が発生しない方を選んだ
- **書体CSSで描画をブロックしない。** `media="print"`+`onload`で読み込む。素の`<link>`では取得完了まで最初の描画が始まらない(実測: レンダーブロック1170ms・FCP 2.6s・Lighthouse性能92が、非ブロック化で150ms・1.6s・94)。`display=swap`である以上、本文はどのみち代替書体で先に表示されるため、描画を止める理由がない
- **静的配信のSPAでも直リンクを実際の200応答で返す。** ルートごとに`dist/index.html`を複製する後処理(`scripts/emit-routes.mjs`)で実現する
- **色は`src/styles/tokens.css`の1ファイルに集約する。** リテラル指定を禁止しているため、テーマ切り替えから漏れる色が生まれない

## 品質とCI

`main`へのpushでGitHub Actionsがビルドし、**配信物に対して**次の検査を実測してからPagesへ公開します。

| 検査 | 内容 |
|---|---|
| typecheck / test / lint | `tsc -b`/Vitest/oxlint |
| アクセシビリティ | 全ルートでaxeを実行し、WCAG違反0件を確認 |
| 日本語改行 | BudouXの文節に沿った改行か・禁則を破っていないかを複数の画面幅で実測 |
| 性能 | Lighthouseで計測し、結果をサイトのフッター(MEASURED)に掲示 |

ローカルのPASSだけでは完了と見なさず、配信版でも同じ確認を繰り返す運用です。

## 技術スタック

`package.json`記載のバージョンをそのまま載せています。

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
npm run build       # tsc -b && vite build && emit-routes(dist/を生成)
npm run preview     # ビルド結果をポート4173でプレビュー
npm run test        # vitest run
npm run typecheck   # tsc -b --noEmit
npm run lint        # oxlint
```

書体はGoogle Fontsから配信します(`index.html`の`<link>`。`/ko/`用の差し替えは`scripts/emit-routes.mjs`が行います)。unicode-rangeで分割済みのため、コンテンツに文字を足してもフォント側の作業は不要です。

> 配信はSettings → Pages → Sourceを「GitHub Actions」にした状態で、`main`へのpushにより行われます。

</div>
