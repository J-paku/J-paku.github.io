<!-- GitHubはREADMEをlang="en"のページに埋め込むため、ブラウザが日本語のCJK字形を選べず、
     中国語・韓国語の字形に落ちることがある。本文をlang="ja"で包んで字形を確定させる。
     空行を挟めば中のMarkdownは通常どおり解釈される -->
<div lang="ja">

# J-paku.github.io

ポートフォリオのハブサイト。GitHub Pagesのユーザーサイトとして`https://j-paku.github.io/`に配信しています。

トップは**歩いて回る小さな村**です。矢印キー・WASD・タップで動き、5か所の前に立つと会話窓が開きます。1分で「何を作ったか」より「どんな問題を解くか」が分かる構成にしています。村を飛ばしたい人のために、右下の「一覧で見る」から従来の一覧画面(`/list`)へいつでも行けます。

**まずこの2つ。** どちらもブラウザだけで、そのまま触れます。

- [**座席マップデモ**](https://j-paku.github.io/seatmap-demo/) — オフィスの座席とチーム配置を、指の操作でそのまま扱う。実務の社内座席管理ツールをモックデータで再構成
- [**チーム標準のAI開発基盤**](https://j-paku.github.io/ai-harness/) — AIの行動をコードで縛り、チームへ配布・定着まで

| 座席マップデモ | チーム標準のAI開発基盤 |
|---|---|
| [![座席マップデモ](https://j-paku.github.io/shots/seatmap-demo.svg)](https://j-paku.github.io/seatmap-demo/) | [![チーム標準のAI開発基盤](https://j-paku.github.io/shots/ai-harness.svg)](https://j-paku.github.io/ai-harness/) |

## これは何か

seatmap-demo・ai-harness・名刺登録アプリなどの作品を1か所にまとめ、「何を作ったか」だけでなく**「なぜそう作ったか」**まで見せるためのサイトです。

| 画面 | パス | 役割 |
|---|---|---|
| 村 | `/`・`/ko/` | レトロRPG風の一画面マップ。5か所(自宅・名刺工房・インタラクション研究所・AI作業台・広場)で短い会話を読む |
| 一覧 | `/list/`・`/ko/list/` | 経歴・作品カード・折りたたみ詳細(症状→原因→解決)。JSが無くても読める |
| 作品ストーリー | `/works/<slug>/` | iPhone枠の中で画面が切り替わるスクロールストーリー(現在は名刺アプリの1本) |

## 主な特徴

- **日本語/한국어の2言語対応** — 言語はURLパスだけで決まる(`/`=ja、`/ko`=ko)。ルートグループ`(ja)`と`(ko)/ko`の2本で同じサーバーコンポーネントを呼ぶ
- **村はDOMだけで動く** — Canvas・WebGL・ゲームエンジン不使用。マス目はCSS Grid、キャラクターは`transform`1枚。移動・衝突・経路(BFS)・会話地点の判定は`src/lib/village/`の純粋関数で、React・DOMに依存しない
- **ドット絵は自作、コードで描く** — `src/lib/pixel/`でタイルとキャラクターを文字マトリクスとして定義し、8×8部品4枚→16×16メタタイルの組み立て・左右反転・パレット差し替えでバリエーションを作る。ビルド時に1枚のSVGスプライトシートへ合成し、`background-position`で参照する。CHRバンクで絵を管理していたゲーム機の作法を、メモリ制約ではなく一貫性と転送量のために採っている。原作ゲームの素材は一切使わない
- **小さく保つ** — 村は20×18マス・家4棟・開始地点からどの会話地点も20歩以内。ビルド時の検証が上限を超えると落とす(訪問者を歩かせすぎない歯止め)
- **アクセシビリティ** — 村を操作しなくても、スキップリンクと作品ショートカットで同じ内容に到達できる。会話窓は`aria-live`、モーダルはフォーカストラップとEsc
- **実キャプチャ不使用** — 業務データが写り込むため、画面はすべて自作SVG(図解・アニメーション)で再現
- **ライト/ダークテーマ** — 右上で切り替え。初回描画前にインラインスクリプトで保存値を適用し、ちらつきを避ける

## 設計上の決定

- **Next.js App Routerの静的エクスポート。** Server Actions・ISR・Middlewareは使わない。`generateStaticParams`で作品ページを列挙し、`dynamicParams=false`で未知のslugは404にする
- **`'use client'`は村の入口1ファイルだけ。** 一覧・作品ページはサーバーコンポーネント。作品ページ内のモーダル・ポップオーバーだけを小さな島として切り出す
- **localeは`pathname`だけで決める。** 自動リダイレクトも`?lang=`も設けず、URLを唯一の情報源にする
- **表示文字列はすべて`content/`(ja・ko)に置き、コンポーネントへハードコードしない。** 両言語が同一の型を満たすため、翻訳キーの過不足は`tsc`が検出する。ko側の欠けをjaで黙って埋めることはせず、ビルドを失敗させる
- **コンテンツはビルド時に検証する。** ja/koのslug・status・場面IDの一致、登録表とファイルの突き合わせ、村の座標・ID重複・到達性・歩数上限を`src/lib/content/validate.ts`が確認する
- **ブラウザ保存は`src/lib/preferences.ts`の1ファイルに集約する。** テーマは`localStorage`、村の位置と訪問記録は`sessionStorage`
- **色は`src/styles/tokens.css`に集約する。** 例外は村の絵(スプライトと会話窓)で、テーマに関わらず固定色
- **書体はGoogle Fontsから配信する。** unicode-range分割済みのため、コンテンツに文字を足してもフォント側の作業は発生しない

## 品質とCI

`main`へのpushでGitHub Actionsがビルドし、**配信物に対して**次の検査を実測してからPagesへ公開します。

| 検査 | 内容 |
|---|---|
| typecheck / lint / test | `tsc --noEmit` / ESLint(eslint-config-next)+Prettier / Vitest |
| build | `next build`のあと`scripts/verify-export.mjs`が`out/`の必須ページとcss/js参照の実在、二言語404を確認 |
| E2E | Playwrightで村→会話→作品→一覧の導線、壁の衝突、テーマ保存をja/koで実走 |
| アクセシビリティ | 全ルートでaxeを実行し、WCAG違反0件を確認 |
| 日本語改行 | BudouXの文節に沿った改行か・禁則を破っていないかを複数の画面幅で実測 |

ローカルのPASSだけでは完了と見なさず、配信版でも同じ確認を繰り返す運用です。

## 技術スタック

`package.json`記載のバージョンをそのまま載せています。

| 分類 | 技術 | バージョン |
|---|---|---|
| フレームワーク | Next.js(App Router・静的エクスポート) | 16.3.5 |
| UI | React / React DOM | 19.2.8 |
| 言語 | TypeScript | 6.0.2 |
| スタイル | CSS Modules | - |
| 日本語改行 | BudouX | 0.9.0 |
| テスト | Vitest | 4.1.10 |
| E2E | @playwright/test | 1.63.0 |
| Lint / Format | ESLint 9(eslint-config-next 15)/ Prettier 3 | - |
| CI/CD | GitHub Actions(`upload-pages-artifact`) | - |

## ローカルでの実行

```bash
npm install
npm run dev
```

http://localhost:3000 で表示を確認できます。

```bash
npm run build       # next build + verify-export(out/を生成)
npm run start       # out/をポート4173で配信
npm run test        # vitest run
npm run test:e2e    # playwright test(先に build)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run format      # prettier --write
```

## ディレクトリ

```
content/            表示文字列と村の定義(ja/ko・world.ts)と、その型(types/)
src/app/            ルート(ja)/(ko)/ko の2本
src/components/     VillagePage(村)・Directory(一覧)・Story(作品)の3画面と、画面横断の部品 ui/
src/lib/village/    移動・衝突・経路・会話地点の純粋関数
src/lib/pixel/      ドット絵エンジンと素材
src/lib/content/    コンテンツの読み込みと検証
scripts/            verify-export・axe・改行検査
tests/              Playwright E2E
```

> 配信はSettings → Pages → Sourceを「GitHub Actions」にした状態で、`main`へのpushにより行われます。

</div>
